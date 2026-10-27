import { imageInput, requestWithImages, textOrQuoted } from '../src/utils/canvas.js'
import { imageToSticker, packFor, stickerPayload, videoToSticker } from '../src/utils/sticker.js'

const definitions = [
  { commands: ['brat'], description: 'Crea un sticker Brat', params: () => ({ bg: 'ffffff', color: '000000' }) },
  { commands: ['bratvideo', 'bratv'], description: 'Crea un sticker Brat animado', video: true },
  { commands: ['bratestirado'], description: 'Crea un sticker Brat estirado' },
  { commands: ['bratanime'], description: 'Crea un sticker Brat de anime' },
  { commands: ['bratcoyote'], description: 'Crea un sticker Brat de Coyote' },
  { commands: ['bratpinguino'], description: 'Crea un sticker Brat de pingüino', params: () => ({ mode: 'text' }) },
  { commands: ['attp'], description: 'Crea texto animado de colores', video: true },
  { commands: ['ttp'], description: 'Crea un sticker de texto estático' },
  { commands: ['absolutecinema', 'cinema'], description: 'Crea un sticker Absolute Cinema' },
  { commands: ['bratboy', 'cartelboy'], description: 'Crea un sticker Brat Boy', id: 'cartelboy', params: () => ({ mode: 'text' }) },
]

function stickerGenerator(definition) {
  const command = definition.commands[0]
  return {
    commands: definition.commands,
    category: 'stickersmaker',
    description: definition.description,
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}${command} <texto>`)
      await ctx.react('🌙')
      const media = await requestWithImages(ctx, `/canvas/${definition.id || command}`, {
        params: { text, ...(definition.params?.(ctx, text) || {}) },
      })
      const sticker = definition.video
        ? await videoToSticker(media.buffer, packFor(ctx), media.mimetype)
        : await imageToSticker(media.buffer, packFor(ctx))
      await ctx.send(stickerPayload(sticker))
    },
  }
}

export default [
  ...definitions.map(stickerGenerator),
  {
    commands: ['bobesponja', 'bobesponja2', 'bobesponja3'],
    category: 'stickersmaker',
    description: 'Crea un meme de Bob Esponja con tres variantes.',
    usage: '<1/2/3> <texto>',
    async execute(ctx) {
      const args = [...ctx.args]
      let variant = Number(ctx.command.at(-1)) || 1
      if (['1', '2', '3'].includes(args[0])) variant = Number(args.shift())
      const text = args.join(' ').trim() || ctx.m.quoted?.text || ''
      if (!text) return ctx.reply(`☾ Uso: *${ctx.usedPrefix}bobesponja <1/2/3> <texto>*.`)
      const route = variant === 1 ? 'bobesponja' : `bobesponja${variant}`
      await ctx.react('🌙')
      const media = await requestWithImages(ctx, `/canvas/${route}`, { params: { text, mode: 'text' } })
      const sticker = await imageToSticker(media.buffer, packFor(ctx))
      await ctx.send(stickerPayload(sticker))
    },
  },
  {
    commands: ['sgay'],
    category: 'stickersmaker',
    description: 'Crea un sticker Gay Card con imagen y texto.',
    usage: '<foto> <texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Usa *${ctx.usedPrefix}sgay <texto>* respondiendo a una imagen.`)
      const source = await imageInput(ctx, { required: true })
      await ctx.react('🌙')
      const media = await requestWithImages(ctx, '/canvas/gaycard', {
        params: { name: text },
        sources: { url: source },
      })
      const sticker = await imageToSticker(media.buffer, packFor(ctx))
      await ctx.send(stickerPayload(sticker))
    },
  },
  {
    commands: ['emojimix', 'emix'],
    category: 'stickersmaker',
    description: 'Mezcla dos emojis en un sticker',
    usage: '<emoji> <emoji>',
    async execute(ctx) {
      const emojis = textOrQuoted(ctx).split(/[\s+]+/u).filter(Boolean)
      if (emojis.length < 2) {
        return ctx.reply(`☾ Uso: ${ctx.usedPrefix}emojimix 😂 😈`)
      }
      await ctx.react('😈')
      const media = await requestWithImages(ctx, '/canvas/emojimix', {
        params: { emoji1: emojis[0], emoji2: emojis[1] },
      })
      const sticker = await imageToSticker(media.buffer, packFor(ctx))
      await ctx.send(stickerPayload(sticker))
    },
  },
]
