import { downloadContentFromMessage } from '@whiskeysockets/baileys'

const MEDIA_TYPES = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  stickerMessage: 'sticker',
  documentMessage: 'document',
}

// Buffer temporal de imágenes recibidas (álbumes) por chat + remitente.
// Permite que .pack add procese varias fotos de un álbum en una sola ejecución.
const PENDING_MEDIA_TTL = 60 * 1000
export const pendingMedia = new Map()

export function addPendingMedia(chatId, senderId, rawMessage) {
  const key = `${chatId}:${senderId}`
  let entries = pendingMedia.get(key)
  if (!entries) {
    entries = []
    pendingMedia.set(key, entries)
    setTimeout(() => {
      if (pendingMedia.get(key) === entries) pendingMedia.delete(key)
    }, PENDING_MEDIA_TTL).unref?.()
  }
  entries.push(rawMessage)
  return entries
}

export function getPendingMedia(chatId, senderId) {
  const key = `${chatId}:${senderId}`
  const entries = pendingMedia.get(key)
  if (!entries) return []
  pendingMedia.delete(key)
  return entries
}

export function locateMedia(message) {
  if (!message) return null
  for (const [key, type] of Object.entries(MEDIA_TYPES)) {
    if (message[key]) return { node: message[key], type, mimetype: message[key].mimetype || '' }
  }
  return null
}

export async function downloadMessageMedia(m, {
  quoted = true,
  types = Object.values(MEDIA_TYPES),
  maxBytes = 16 * 1024 * 1024,
} = {}) {
  const sources = quoted ? [m.quoted?.message, m.message] : [m.message]
  for (const source of sources) {
    const media = locateMedia(source)
    if (!media || !types.includes(media.type)) continue
    const stream = await downloadContentFromMessage(media.node, media.type)
    const chunks = []
    let total = 0
    for await (const chunk of stream) {
      total += chunk.length
      if (total > maxBytes) throw new Error(`El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB`)
      chunks.push(chunk)
    }
    return {
      buffer: Buffer.concat(chunks, total),
      mimetype: media.mimetype || `${media.type}/jpeg`,
      type: media.type,
      size: total,
    }
  }
  return null
}

export function mediaPayload(media, kind, caption = '') {
  const resolvedKind = kind === 'auto'
    ? media.mimetype.startsWith('video/') ? 'video'
      : media.mimetype.startsWith('audio/') ? 'audio'
        : 'image'
    : kind
  const supportsCaption = !['audio'].includes(resolvedKind)
  const common = {
    mimetype: media.mimetype,
    ...(caption && supportsCaption ? { caption } : {}),
  }
  if (resolvedKind === 'audio') return { audio: media.buffer, ...common }
  if (resolvedKind === 'video') return { video: media.buffer, ...common }
  if (resolvedKind === 'gif') return { video: media.buffer, gifPlayback: true, ...common }
  if (resolvedKind === 'document') {
    return { document: media.buffer, fileName: media.filename || 'velirius-file', ...common }
  }
  return { image: media.buffer, ...common }
}
