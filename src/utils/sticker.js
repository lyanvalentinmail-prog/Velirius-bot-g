import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import webp from 'node-webpmux'

const STICKER_SIZE = 512
const MAX_STATIC_STICKER_BYTES = 100 * 1024
const MAX_ANIMATED_STICKER_BYTES = 500 * 1024
const ANIMATED_ENCODE_BYTES = 480 * 1024
const EXIF_HEADER = Buffer.from([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
])

export function packFor(ctx) {
  const user = ctx.db?.data?.users?.[ctx.userKey] || {}
  return {
    packName: user.packname || ctx.config.botName || 'Velirius Bot',
    packAuthor: user.author || ctx.m.name || 'Velirius',
    emojis: ['☾'],
  }
}

export function isAnimatedWebp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 ||
      buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return false
  }
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    if (chunk === 'ANIM' || chunk === 'ANMF') return true
    if (chunk === 'VP8X' && offset + 8 < buffer.length && (buffer[offset + 8] & 0x02)) return true
    offset += 8 + size + (size % 2)
  }
  return false
}

export function stickerPayload(buffer) {
  return {
    sticker: buffer,
    mimetype: 'image/webp',
    isAnimated: isAnimatedWebp(buffer),
    width: STICKER_SIZE,
    height: STICKER_SIZE,
  }
}

export async function addStickerExif(buffer, {
  packName = 'Velirius Bot',
  packAuthor = 'Velirius',
  emojis = ['☾'],
} = {}) {
  const packId = createHash('sha256')
    .update(`${packName}|${packAuthor}`)
    .digest('hex')
    .slice(0, 32)
  const json = {
    'sticker-pack-id': packId,
    'sticker-pack-name': String(packName).slice(0, 128),
    'sticker-pack-publisher': String(packAuthor).slice(0, 128),
    emojis: Array.isArray(emojis) ? emojis.slice(0, 8) : ['☾'],
  }
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
  const exif = Buffer.alloc(EXIF_HEADER.length + jsonBuffer.length)
  EXIF_HEADER.copy(exif, 0)
  exif.writeUIntLE(jsonBuffer.length, 14, 4)
  jsonBuffer.copy(exif, EXIF_HEADER.length)

  const image = new webp.Image()
  await image.load(buffer)
  image.exif = exif
  return image.save(null)
}

export async function imageToSticker(buffer, pack = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('La imagen llegó vacía.')
  for (const quality of [82, 65, 50, 35, 25, 15, 10]) {
    const output = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'error' })
      .rotate()
      .resize(STICKER_SIZE, STICKER_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
      .webp({ quality, effort: 4 })
      .toBuffer()
    const sticker = await addStickerExif(output, pack)
    if (sticker.length <= MAX_STATIC_STICKER_BYTES) return sticker
  }
  throw new Error('No se pudo comprimir la imagen a un sticker válido de 100 KB o menos.')
}

function extensionFor(mimetype = '') {
  const mime = mimetype.toLowerCase()
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('quicktime')) return 'mov'
  return 'mp4'
}

async function runFfmpeg(args, { input = null, timeoutMs = 90_000 } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let timedOut = false
    let settled = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    timer.unref?.()

    const finish = error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    }
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk.toString()}`.slice(-5000)
    })
    child.once('error', error => {
      if (error.code === 'ENOENT') {
        finish(new Error('FFmpeg no está instalado. En Termux ejecuta: pkg install ffmpeg'))
      } else finish(error)
    })
    child.once('close', code => {
      if (timedOut) return finish(new Error('FFmpeg tardó demasiado; intenta con un video más corto.'))
      if (code !== 0) return finish(new Error(`FFmpeg no pudo convertir el archivo: ${stderr.slice(-500)}`))
      finish()
    })
    if (input) {
      child.stdin.once('error', error => {
        if (error.code !== 'EPIPE') finish(error)
      })
      child.stdin.end(input)
    }
  })
}

async function convertVideoToWebp(input, output, { seconds, fps, quality }) {
  await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-t', String(seconds),
    '-vf', `scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease:flags=lanczos,fps=${fps},pad=${STICKER_SIZE}:${STICKER_SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba`,
    '-an', '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(quality),
    '-loop', '0', '-preset', 'picture', '-fs', String(ANIMATED_ENCODE_BYTES),
    output,
  ])
}

export async function videoToSticker(buffer, pack = {}, mimetype = 'video/mp4') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('El video llegó vacío.')
  const directory = await mkdtemp(path.join(tmpdir(), 'velirius-sticker-'))
  const input = path.join(directory, `input.${extensionFor(mimetype)}`)
  try {
    await writeFile(input, buffer)
    const attempts = [
      { seconds: 6, fps: 12, quality: 65 },
      { seconds: 4, fps: 10, quality: 45 },
      { seconds: 3, fps: 8, quality: 30 },
    ]
    for (const [index, attempt] of attempts.entries()) {
      const output = path.join(directory, `sticker-${index}.webp`)
      await convertVideoToWebp(input, output, attempt)
      const sticker = await addStickerExif(await readFile(output), pack)
      const limit = isAnimatedWebp(sticker) ? MAX_ANIMATED_STICKER_BYTES : MAX_STATIC_STICKER_BYTES
      if (sticker.length <= limit) return sticker
    }
    throw new Error('No se pudo comprimir el video a un sticker válido para WhatsApp.')
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}

export async function createSticker(media, pack = {}) {
  const mimetype = String(media.mimetype || '').toLowerCase()
  if (media.type === 'video' || mimetype.includes('gif') || mimetype.startsWith('video/')) {
    return videoToSticker(media.buffer, pack, mimetype)
  }
  return imageToSticker(media.buffer, pack)
}

export async function stickerToImage(buffer) {
  return sharp(buffer, { animated: false, failOn: 'error' }).png().toBuffer()
}

export async function stickerToVideo(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('El sticker llegó vacío.')
  const metadata = await sharp(buffer, { animated: true, failOn: 'error' }).metadata()
  const animated = (metadata.pages || 1) > 1
  const directory = await mkdtemp(path.join(tmpdir(), 'velirius-tovid-'))
  const input = path.join(directory, 'sticker.webp')
  const output = path.join(directory, 'sticker.mp4')
  try {
    let inputArgs
    let rawInput = null
    if (animated) {
      const delays = (metadata.delay || []).filter(delay => delay > 0)
      const averageDelay = delays.length
        ? delays.reduce((total, delay) => total + delay, 0) / delays.length
        : 1000 / 12
      const fps = Math.min(30, Math.max(1, Math.round(1000 / averageDelay)))
      const frames = Math.min(metadata.pages, fps * 8)
      const frameHeight = metadata.pageHeight || Math.round(metadata.height / metadata.pages)
      const decoded = await sharp(buffer, { pages: frames, failOn: 'error' })
        .ensureAlpha()
        .raw()
        .toBuffer()
      const expectedBytes = metadata.width * frameHeight * frames * 4
      if (decoded.length < expectedBytes) throw new Error('No se pudieron decodificar todos los cuadros del sticker.')
      rawInput = decoded.length === expectedBytes ? decoded : decoded.subarray(0, expectedBytes)
      inputArgs = [
        '-f', 'rawvideo', '-pixel_format', 'rgba',
        '-video_size', `${metadata.width}x${frameHeight}`,
        '-framerate', String(fps), '-i', 'pipe:0',
      ]
    } else {
      await writeFile(input, buffer)
      inputArgs = ['-loop', '1', '-i', input]
    }

    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error', '-y',
      ...inputArgs,
      '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p',
      '-t', animated ? '8' : '3', '-r', '30', '-an',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
    ], { input: rawInput })
    return readFile(output)
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}
