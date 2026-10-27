import { isHttpUrl } from '../src/utils/format.js'
import { downloadMessageMedia, mediaPayload } from '../src/utils/media.js'

async function uploadRepliedImage(ctx, required = false) {
  const media = await downloadMessageMedia(ctx.m, {
    types: ['image'],
    maxBytes: 15 * 1024 * 1024,
  })
  if (!media) {
    if (required) throw new Error('Responde a una imagen o indica una URL pública.')
    return ''
  }
  const mimetype = media.mimetype === 'image/jpg' ? 'image/jpeg' : media.mimetype
  const uploaded = await ctx.api.uploadImage(media.buffer, mimetype)
  return uploaded.url
}

function textOrQuoted(ctx) {
  return ctx.text || ctx.m.quoted?.text || ''
}

export default [
  {
    commands: ['brat'],
    category: 'canvas',
    description: 'Crea una imagen estilo Brat.',
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}brat Velirius Bot`)
      await ctx.react('🤍')
      const media = await ctx.api.media('/canvas/brat', { text })
      await ctx.send(mediaPayload(media, 'image'))
    },
  },
  {
    commands: ['bratvideo', 'bratv'],
    category: 'canvas',
    description: 'Crea un video Brat con palabras progresivas.',
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}bratvideo Velirius Bot`)
      await ctx.react('🎬')
      const media = await ctx.api.media('/canvas/bratvideo', { text })
      await ctx.send(mediaPayload(media, 'video'))
    },
  },
  {
    commands: ['ttp'],
    category: 'canvas',
    description: 'Convierte texto en una imagen espaciada.',
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}ttp VELIRIUS`)
      const media = await ctx.api.media('/canvas/ttp', { text })
      await ctx.send(mediaPayload(media, 'image'))
    },
  },
  {
    commands: ['quotly', 'qc'],
    category: 'canvas',
    description: 'Crea una cita con avatar y burbuja de chat.',
    usage: '<texto> (responde a una foto para usarla)',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}quotly Hola a todos`)
      await ctx.react('💬')
      let image = await uploadRepliedImage(ctx)
      const avatarOwner = ctx.m.quoted?.sender || ctx.m.sender
      if (!image && avatarOwner) {
        image = await ctx.sock.profilePictureUrl(avatarOwner, 'image').catch(() => '')
      }
      const media = await ctx.api.media('/canvas/quotly', {
        text,
        username: ctx.m.quoted?.sender ? 'Mensaje citado' : ctx.m.name,
        ...(image ? { image } : {}),
      })
      await ctx.send(mediaPayload(media, 'image'))
    },
  },
  {
    commands: ['emojimix', 'mezclaremoji'],
    category: 'canvas',
    description: 'Mezcla dos emojis en una imagen.',
    usage: '<emoji1> <emoji2>',
    async execute(ctx) {
      const [emoji1, emoji2] = ctx.args
      if (!emoji1 || !emoji2) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}emojimix 😀 😂`)
      const media = await ctx.api.media('/canvas/emojimix', { emoji1, emoji2 })
      await ctx.send(mediaPayload(media, 'image'))
    },
  },
  {
    commands: ['resize', 'redimensionar'],
    category: 'tools',
    description: 'Redimensiona una imagen respondida o por URL.',
    usage: '[url] <ancho> [alto]',
    async execute(ctx) {
      const url = ctx.args.find(isHttpUrl)
      const image = url || await uploadRepliedImage(ctx, true)
      const dimensions = ctx.args.filter(arg => /^\d+$/.test(arg)).map(Number)
      const width = dimensions[0] || 512
      const height = dimensions[1]
      if (width > 4096 || height > 4096) return ctx.reply('☾ Las dimensiones máximas son 4096 × 4096.')
      await ctx.react('📐')
      const media = await ctx.api.media('/tools/resize', {
        url: image,
        width,
        ...(height ? { height } : {}),
        format: 'png',
      })
      await ctx.send(mediaPayload(media, 'image', `☾ ${width}${height ? ` × ${height}` : ''} px`))
    },
  },
]
