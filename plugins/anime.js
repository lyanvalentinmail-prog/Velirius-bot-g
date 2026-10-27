import { mediaPayload } from '../src/utils/media.js'
import { truncate } from '../src/utils/format.js'

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
  {
    commands: ['pokemon', 'pokedex'],
    category: 'anime',
    description: 'Muestra arte, tipos y estadísticas de un Pokémon.',
    usage: '<nombre, ID o random>',
    async execute(ctx) {
      const query = ctx.text || 'random'
      await ctx.react('⚡')
      const shiny = ctx.args.includes('shiny')
      const cleanQuery = ctx.args.filter(arg => arg.toLowerCase() !== 'shiny').join(' ') || 'random'
      const data = await ctx.api.json('/anime/pokemon', { query: cleanQuery || query, shiny })
      const stats = Object.entries(data.stats || {}).map(([name, value]) => `${name}: ${value}`).join(' · ')
      const caption = truncate(`☾ *${String(data.name || cleanQuery).toUpperCase()}* #${data.id || '?'}\n> Tipos: ${(data.types || []).join(', ') || 'Desconocidos'}\n> Altura: ${data.height_m ?? '?'} m · Peso: ${data.weight_kg ?? '?'} kg\n> ${data.description || ''}\n\n${stats}`, 3500)
      if (data.image) return ctx.send({ image: { url: data.image }, caption })
      await ctx.reply(caption)
    },
  },
]
