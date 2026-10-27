import { mediaPayload } from '../src/utils/media.js'

function animeCommand(id, aliases, description) {
  return {
    commands: [id, ...aliases],
    category: 'anime',
    description,
    async execute(ctx) {
      await ctx.react('🌙')
      const media = await ctx.api.media(`/anime/${id}`, { direct: 'true', amount: 1 })
      await ctx.send(mediaPayload(media, 'image', `☾ ${id.toUpperCase()} · Velirius API`))
    },
  }
}

export default [
  animeCommand('neko', [], 'Envía una imagen aleatoria de neko.'),
  animeCommand('waifu', [], 'Envía una imagen aleatoria de waifu.'),
  animeCommand('maid', [], 'Envía una imagen aleatoria de maid.'),
]
