import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import webp from 'node-webpmux'

const STICKER_SIZE = 512
const MAX_STICKER_BYTES = 950 * 1024

export function packFor(ctx) {
  const user = ctx.db?.data?.users?.[ctx.userKey] || {}
  return {
    packName: user.packname || ctx.config.botName || 'Velirius Bot',
    packAuthor: user.author || ctx.m.name || 'Velirius',
    emojis: ['☾'],
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
  const exif = Buffer.alloc(22 + jsonBuffer.length)
  exif.write('Exif', 0, 'ascii')
  exif.writeUInt32LE(jsonBuffer.length, 14, 'little')
  jsonBuffer.copy(exif, 22)

  const image = new webp.Image()
  await image.load(buffer)
  image.exif = exif
  return image.save(null)
}

export async function imageToSticker(buffer, pack = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('La imagen llegó vacía.')
  let output
  for (const quality of [82, 65, 48]) {
    output = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'error' })
      .rotate()
      .resize(STICKER_SIZE, STICKER_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
      .webp({ quality, effort: 4 })
      .toBuffer()
    if (output.length <= MAX_STICKER_BYTES) break
  }
  return addStickerExif(output, pack)
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

async function convertVideoToWebp(input, output, size, seconds, fps) {
  await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-t', String(seconds),
    '-vf', `scale=${size}:${size}:force_original_aspect_ratio=decrease:flags=lanczos,fps=${fps},pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba`,
    '-an', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '65',
    '-loop', '0', '-preset', 'picture', '-fs', String(MAX_STICKER_BYTES),
    output,
  ])
}

export async function videoToSticker(buffer, pack = {}, mimetype = 'video/mp4') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('El video llegó vacío.')
  const directory = await mkdtemp(path.join(tmpdir(), 'velirius-sticker-'))
  const input = path.join(directory, `input.${extensionFor(mimetype)}`)
  try {
    await writeFile(input, buffer)
    let output = path.join(directory, 'sticker.webp')
    await convertVideoToWebp(input, output, STICKER_SIZE, 6, 12)
    let result = await readFile(output)
    if (result.length > MAX_STICKER_BYTES) {
      output = path.join(directory, 'sticker-small.webp')
      await convertVideoToWebp(input, output, 320, 4, 10)
      result = await readFile(output)
    }
    return addStickerExif(result, pack)
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
