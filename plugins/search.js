import { firstDefined, isHttpUrl, truncate } from '../src/utils/format.js'
import { mediaPayload } from '../src/utils/media.js'

function resultsOf(result) {
  if (Array.isArray(result)) return result
  return result?.results || result?.items || result?.data || []
}

function authorOf(author) {
  if (!author) return ''
  if (typeof author === 'string') return author
  return author.nickname || author.username || author.name || ''
}

function formatResults(result, kind) {
  const items = resultsOf(result).slice(0, 5)
  if (!items.length) return 'No se encontraron resultados.'
  return items.map((item, index) => {
    const title = firstDefined(item.title, item.name, item.description, `Resultado ${index + 1}`)
    const details = [
      authorOf(item.author),
      item.duration ? `Duración: ${item.duration}` : '',
      item.views ? `Vistas: ${item.views}` : '',
      item.stats?.plays ? `Reproducciones: ${item.stats.plays}` : '',
    ].filter(Boolean).join(' · ')
    const description = item.snippet || item.extract || (kind === 'pinterest' ? item.description : '')
    const url = item.url || item.fullurl || item.video_nowatermark || item.image || item.video || ''
    return `*${index + 1}. ${String(title).slice(0, 180)}*${details ? `\n${details}` : ''}${description ? `\n${String(description).slice(0, 500)}` : ''}${url ? `\n${url}` : ''}`
  }).join('\n\n')
}

export async function search(ctx, route) {
  if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}${ctx.command} ${ctx.plugin.usage}`)
  await ctx.react('🔎')
  const result = await ctx.api.json(route, { query: ctx.text, limit: 5, lang: 'es' })
  await ctx.reply(truncate(`☾ *RESULTADOS: ${ctx.text}*\n\n${formatResults(result, ctx.command)}`, 14000))
}

export default [
  {
    commands: ['google', 'buscar'],
    category: 'searcher',
    description: 'Busca páginas en la web.',
    usage: '<búsqueda>',
    execute: ctx => search(ctx, '/searcher/google'),
  },
  {
    commands: ['yts', 'ytsearch', 'youtube'],
    category: 'searcher',
    description: 'Busca videos en YouTube.',
    usage: '<búsqueda>',
    execute: ctx => search(ctx, '/searcher/youtube'),
  },
  {
    commands: ['ttsearch', 'tiktoksearch'],
    category: 'searcher',
    description: 'Busca videos en TikTok.',
    usage: '<búsqueda>',
    execute: ctx => search(ctx, '/searcher/tiktok'),
  },
  {
    commands: ['wiki', 'wikipedia'],
    category: 'searcher',
    description: 'Busca artículos en Wikipedia.',
    usage: '<tema>',
    execute: ctx => search(ctx, '/searcher/wikipedia'),
  },
  {
    commands: ['pinterest', 'pin'],
    category: 'searcher',
    description: 'Busca y envía tres imágenes de Pinterest.',
    usage: '<búsqueda>',
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}pinterest <búsqueda o URL>`)
      if (isHttpUrl(ctx.text)) {
        await ctx.react('⏳')
        const media = await ctx.api.media('/downloader/pinterest', { url: ctx.text, direct: 'true' })
        return ctx.send(mediaPayload(media, 'auto', `☾ ${ctx.config.botName}`))
      }
      await ctx.react('📌')
      const result = await ctx.api.json('/searcher/pinterest', { query: ctx.text, limit: 3 })
      const items = resultsOf(result).slice(0, 3)
      if (!items.length) return ctx.reply('☾ No se encontraron imágenes.')
      for (const [index, item] of items.entries()) {
        const source = item.image || item.thumbnail || item.video
        if (!source) continue
        const caption = `☾ ${item.title || ctx.text} (${index + 1}/${items.length})${item.url ? `\n${item.url}` : ''}`
        await ctx.send(item.video && !item.image
          ? { video: { url: item.video }, caption }
          : { image: { url: source }, caption })
      }
    },
  },
]
