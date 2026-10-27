import { downloadMessageMedia, getPendingMedia } from '../src/utils/media.js'
import {
  createSticker,
  imageToSticker,
  packFor,
  stickerPayload,
  stickerToImage,
  stickerToVideo,
} from '../src/utils/sticker.js'
import { sendStickerPack } from '../src/utils/sticker-pack.js'

const MAX_MEDIA_BYTES = 16 * 1024 * 1024
const MAX_PACK_STICKERS = 60
const PACK_SESSION_TTL = 15 * 60 * 1000

// Las imágenes permanecen sólo en memoria y cada chat/usuario tiene su sesión.
export const packSessions = new Map()

function packSessionKey(ctx) {
  return `${ctx.m.chat}:${ctx.userKey || ctx.m.sender}`
}

function touchPackSession(key, session) {
  clearTimeout(session.timer)
  session.timer = setTimeout(() => {
    if (packSessions.get(key) !== session) return
    if (session.busy) return touchPackSession(key, session)
    packSessions.delete(key)
  }, PACK_SESSION_TTL)
  session.timer.unref?.()
}

function clearPackSession(key) {
  const session = packSessions.get(key)
  if (!session) return
  clearTimeout(session.timer)
  packSessions.delete(key)
}

export default [
  {
    commands: ['sticker', 's', 'st'],
    category: 'stickerseditor',
    description: 'Convierte una imagen o video corto en sticker',
    usage: '(responde a una imagen o video)',
    async execute(ctx) {
      const media = await downloadMessageMedia(ctx.m, {
        types: ['image', 'video'],
        maxBytes: MAX_MEDIA_BYTES,
      })
      if (!media) return ctx.reply('☾ Responde a una imagen o video con el comando .sticker')
      await ctx.react('🌙')
      const sticker = await createSticker(media, packFor(ctx))
      await ctx.send(stickerPayload(sticker))
    },
  },
  {
    commands: ['toimg', 'toimage', 'img'],
    category: 'stickerseditor',
    description: 'Extrae la imagen de un sticker',
    usage: '(responde a un sticker)',
    async execute(ctx) {
      const media = await downloadMessageMedia(ctx.m, {
        types: ['sticker'],
        maxBytes: MAX_MEDIA_BYTES,
      })
      if (!media) return ctx.reply('☾ Responde a un sticker con el comando .toimg')
      await ctx.react('🖼️')
      const image = await stickerToImage(media.buffer)
      await ctx.send({ image, mimetype: 'image/png', caption: '☾ Sticker convertido a imagen.' })
    },
  },
  {
    commands: ['tovid', 'tomp4'],
    category: 'stickerseditor',
    description: 'Convierte un sticker animado o estático en MP4',
    usage: '(responde a un sticker)',
    async execute(ctx) {
      const media = await downloadMessageMedia(ctx.m, {
        types: ['sticker'],
        maxBytes: MAX_MEDIA_BYTES,
      })
      if (!media) return ctx.reply('☾ Responde a un sticker con el comando .tovid')
      await ctx.react('🎬')
      const video = await stickerToVideo(media.buffer)
      await ctx.send({ video, mimetype: 'video/mp4', fileName: 'velirius-sticker.mp4' })
    },
  },
  {
    commands: ['pack', 'setpack', 'setmeta'],
    category: 'stickerseditor',
    description: 'Crea y envía un paquete de stickers',
    usage: '<nombre>,<autor> | add | done | cancel',
    async execute(ctx) {
      const key = packSessionKey(ctx)
      const session = packSessions.get(key)
      const text = ctx.text.trim()
      const action = text.toLowerCase()
      const prefix = ctx.usedPrefix
      const usage = `📦 ☾ Usa ${prefix}pack nombre,autor para iniciar un paquete.`

      if (action === 'cancel') {
        if (!session) return ctx.reply(`📦 ☾ No tienes un paquete en curso.`)
        if (session.busy) return ctx.reply(`📦 ☾ Espera a que termine la operación actual y vuelve a cancelar.`)
        clearPackSession(key)
        return ctx.reply(`📦 ☾ Paquete cancelado; se descartaron sus imágenes.`)
      }
      if (session?.busy) return ctx.reply(`📦 ☾ Ya hay una operación en curso para este paquete. Inténtalo de nuevo en un momento.`)

      if (action === 'add') {
        if (!session) return ctx.reply(`📦 ☾ Primero inicia un paquete con ${prefix}pack nombre,autor.`)
        if (session.stickers.length >= MAX_PACK_STICKERS) {
          return ctx.reply(`📦 ☾ El paquete ya tiene el máximo de ${MAX_PACK_STICKERS} imágenes. Usa ${prefix}pack done.`)
        }
        session.busy = true
        try {
          const download = ctx.downloadMedia || downloadMessageMedia
          const mediaList = []

          // 1) Responder a una foto concreta
          if (ctx.m.quoted?.message?.imageMessage) {
            const media = await download(ctx.m, {
              types: ['image'],
              maxBytes: MAX_MEDIA_BYTES,
            })
            if (media) mediaList.push(media)
          }

          // 2) Fotos pendientes de un álbum (varias imágenes enviadas seguidas)
          if (mediaList.length === 0) {
            const pending = getPendingMedia(ctx.m.chat, ctx.m.sender)
            for (const raw of pending) {
              const media = await downloadMessageMedia(raw, {
                types: ['image'],
                maxBytes: MAX_MEDIA_BYTES,
              })
              if (media) mediaList.push(media)
            }
          }

          // 3) Imagen del mensaje actual sin quoted (respuesta directa al comando)
          if (mediaList.length === 0) {
            const media = await download(ctx.m, {
              types: ['image'],
              maxBytes: MAX_MEDIA_BYTES,
            })
            if (media) mediaList.push(media)
          }

          if (mediaList.length === 0) {
            return ctx.reply(`📦 ☾ Responde a una foto con ${prefix}pack add o envía varias fotos de un álbum con ese comando.`)
          }

          let added = 0
          for (const media of mediaList) {
            if (session.stickers.length >= MAX_PACK_STICKERS) break
            const sticker = await imageToSticker(media.buffer, {
              packName: session.name,
              packAuthor: session.author,
            })
            session.stickers.push(sticker)
            added += 1
          }

          if (packSessions.get(key) !== session) return
          touchPackSession(key, session)
          return await ctx.reply(
            `📦 ☾ ${added} imagen${added !== 1 ? 'es' : ''} agregada${added !== 1 ? 's' : ''} (${session.stickers.length}/${MAX_PACK_STICKERS}).\n` +
            `Agrega otra con ${prefix}pack add o termina con ${prefix}pack done.`,
          )
        } finally {
          session.busy = false
          if (packSessions.get(key) === session) touchPackSession(key, session)
        }
      }

      if (action === 'done') {
        if (!session) return ctx.reply('📦 ☾ No tienes un paquete en curso.')
        if (!session.stickers.length) return ctx.reply(`📦 ☾ Agrega al menos una foto con ${prefix}pack add.`)
        session.busy = true
        try {
          await sendStickerPack(ctx, {
            name: session.name,
            publisher: session.author,
            stickers: session.stickers,
          }, { upload: ctx.packUpload })
          clearPackSession(key)
        } finally {
          session.busy = false
          if (packSessions.get(key) === session) touchPackSession(key, session)
        }
        return
      }

      if (!text) {
        if (session) {
          return ctx.reply(
            `📦 ☾ Paquete *${session.name}* de *${session.author}*: ${session.stickers.length}/${MAX_PACK_STICKERS} imágenes.\n` +
            `Usa ${prefix}pack add, ${prefix}pack done o ${prefix}pack cancel.`,
          )
        }
        return ctx.reply(usage)
      }

      if (session) {
        return ctx.reply(`📦 ☾ Ya tienes un paquete en curso. Usa ${prefix}pack done para enviarlo o ${prefix}pack cancel para descartarlo.`)
      }
      if (text.length > 200) return ctx.reply(`📦 ☾ El nombre del paquete y el autor no pueden superar 200 caracteres en total.`)
      let separator = text.indexOf(',')
      if (separator < 1) separator = text.indexOf('.')
      if (separator < 1) return ctx.reply(usage)
      const name = text.slice(0, separator).trim()
      const author = text.slice(separator + 1).trim()
      if (!name || !author) return ctx.reply(usage)

      const created = { name, author, stickers: [], busy: false, timer: null }
      packSessions.set(key, created)
      touchPackSession(key, created)
      return ctx.reply(
        `📦 ☾ Paquete *${name}* de *${author}* iniciado.\n` +
        `Agrega fotos con ${prefix}pack add, envíalo con ${prefix}pack done o cancélalo con ${prefix}pack cancel.`,
      )
    },
  },
]
