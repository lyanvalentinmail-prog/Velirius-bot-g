import { downloadMessageMedia } from '../src/utils/media.js'
import {
  createSticker,
  packFor,
  stickerPayload,
  stickerToImage,
  stickerToVideo,
} from '../src/utils/sticker.js'

const MAX_MEDIA_BYTES = 16 * 1024 * 1024

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
    description: 'Configura el nombre y autor de tus stickers',
    usage: '<nombre del pack> | <autor> (o reset)',
    async execute(ctx) {
      const user = ctx.db.data.users[ctx.userKey]
      const current = packFor(ctx)
      if (!ctx.text) {
        return ctx.reply(
          `☾ *METADATA DE STICKERS*\n\nPack: *${current.packName}*\nAutor: *${current.packAuthor}*\n\n` +
          `Usa: ${ctx.usedPrefix}pack Mi Pack | Mi Nombre\nPara restablecer: ${ctx.usedPrefix}pack reset`,
        )
      }
      if (ctx.text.toLowerCase() === 'reset') {
        delete user.packname
        delete user.author
        ctx.db.scheduleSave()
        return ctx.reply('☾ Se restablecieron el pack y autor predeterminados.')
      }
      if (ctx.text.length > 200) return ctx.reply('☾ El nombre del pack y autor no pueden superar 200 caracteres en total.')
      const [packName, ...authorParts] = ctx.text.split('|').map(part => part.trim())
      const author = authorParts.join(' | ').trim()
      if (packName) user.packname = packName
      if (authorParts.length && author) user.author = author
      if (!packName && !author) return ctx.reply('☾ Indica al menos un nombre de pack o autor.')
      ctx.db.scheduleSave()
      const updated = packFor(ctx)
      await ctx.reply(`☾ Metadata actualizada.\nPack: *${updated.packName}*\nAutor: *${updated.packAuthor}*`)
    },
  },
]
