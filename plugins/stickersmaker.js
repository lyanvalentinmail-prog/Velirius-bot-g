import { requestWithImages, textOrQuoted } from '../src/utils/canvas.js'
import { imageToSticker, packFor, videoToSticker } from '../src/utils/sticker.js'

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
  { commands: ['bobesponja'], description: 'Crea un meme de Bob Esponja', params: () => ({ mode: 'text' }) },
  { commands: ['bobesponja2'], description: 'Crea la segunda variante de Bob Esponja', params: () => ({ mode: 'text' }) },
  { commands: ['bobesponja3'], description: 'Crea la tercera variante de Bob Esponja', params: () => ({ mode: 'text' }) },
  { commands: ['cartelboy'], description: 'Crea un cartel de Cartel Boy', params: () => ({ mode: 'text' }) },
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
      const media = await requestWithImages(ctx, `/canvas/${command}`, {
        params: { text, ...(definition.params?.(ctx, text) || {}) },
      })
      const sticker = definition.video
        ? await videoToSticker(media.buffer, packFor(ctx), media.mimetype)
        : await imageToSticker(media.buffer, packFor(ctx))
      await ctx.send({ sticker })
    },
  }
}

export default [
  ...definitions.map(stickerGenerator),
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
      await ctx.send({ sticker: await imageToSticker(media.buffer, packFor(ctx)) })
    },
  },
]
