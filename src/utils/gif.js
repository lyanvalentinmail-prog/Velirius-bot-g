import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function isGifMedia(media = {}) {
  return String(media.mimetype || '').toLowerCase().includes('gif') ||
    Buffer.from(media.buffer || []).subarray(0, 4).toString('ascii') === 'GIF8'
}

export async function gifToMp4(buffer, mimetype = 'image/gif', execute = execFileAsync) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('El GIF llegó vacío.')
  const directory = await mkdtemp(path.join(tmpdir(), 'velirius-gif-'))
  const extension = String(mimetype).toLowerCase().includes('webm') ? 'webm' : 'gif'
  const input = path.join(directory, `input.${extension}`)
  const output = path.join(directory, 'reaction.mp4')
  try {
    await writeFile(input, buffer)
    await execute('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', input,
      '-vf', 'scale=ceil(iw/2)*2:ceil(ih/2)*2:flags=lanczos,fps=30,format=yuv420p',
      '-t', '15', '-an',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
    ], { timeout: 90_000, maxBuffer: 1024 * 1024 })
    return await readFile(output)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('FFmpeg no está instalado. En Termux ejecuta: pkg install ffmpeg')
    }
    if (error.killed || error.signal) {
      throw new Error('FFmpeg tardó demasiado al convertir el GIF.')
    }
    const detail = String(error.stderr || error.message || error).trim().slice(-500)
    throw new Error(`FFmpeg no pudo convertir el GIF: ${detail}`)
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}

export async function gifPlaybackPayload(media, convert = gifToMp4) {
  if (!Buffer.isBuffer(media?.buffer) || !media.buffer.length) {
    throw new Error('La API devolvió un GIF vacío.')
  }
  const mimetype = String(media.mimetype || '').toLowerCase()
  if (!isGifMedia(media) && !mimetype.startsWith('video/')) {
    throw new Error('La API no devolvió un GIF o video válido.')
  }
  const needsConversion = isGifMedia(media) || !mimetype.includes('mp4')
  const video = needsConversion
    ? await convert(media.buffer, media.mimetype)
    : media.buffer
  if (!Buffer.isBuffer(video) || !video.length) throw new Error('La conversión del GIF devolvió un archivo vacío.')
  return {
    video,
    mimetype: 'video/mp4',
    gifPlayback: true,
  }
}
