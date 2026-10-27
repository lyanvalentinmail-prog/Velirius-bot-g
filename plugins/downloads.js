import { isHttpUrl, truncate, urlOrQuery } from '../src/utils/format.js'
import { mediaPayload } from '../src/utils/media.js'
import { search as searchResults } from './search.js'

async function download(ctx, route, params, kind = 'video') {
  await ctx.react('⏳')
  const media = await ctx.api.media(route, params)
  await ctx.send(mediaPayload(media, kind, `☾ ${ctx.config.botName}\n> Velirius API`))
  await ctx.react('✅').catch(() => {})
}

function requireUrl(ctx) {
  if (isHttpUrl(ctx.text)) return true
  ctx.reply(`☾ Debes indicar una URL válida.\nEjemplo: ${ctx.usedPrefix}${ctx.command} ${ctx.plugin.usage.replace(/[<>]/g, '')}`)
  return false
}

function requireText(ctx) {
  if (ctx.text) return true
  ctx.reply(`☾ Uso: ${ctx.usedPrefix}${ctx.plugin.commands[0]} ${ctx.plugin.usage}`)
  return false
}

const qualities = new Set(['360', '480', '720', '1080'])

export default [
  {
    commands: ['play', 'playaudio'],
    category: 'downloader',
    description: 'Busca y descarga una canción completa.',
    usage: '<canción o artista>',
    async execute(ctx) {
      if (!requireText(ctx)) return
      await download(ctx, '/downloader/play', { query: ctx.text, direct: 'true', tries: 3 }, 'audio')
    },
  },
  {
    commands: ['mp3', 'ytmp3'],
    category: 'downloader',
    description: 'Descarga audio MP3 desde YouTube.',
    usage: '<url o búsqueda>',
    async execute(ctx) {
      if (!requireText(ctx)) return
      await download(ctx, '/downloader/mp3', { ...urlOrQuery(ctx.text), direct: 'true' }, 'audio')
    },
  },
  {
    commands: ['mp4', 'ytmp4', 'ytvideo'],
    category: 'downloader',
    description: 'Descarga video MP4 con audio desde YouTube.',
    usage: '<url o búsqueda> [360|480|720|1080]',
    async execute(ctx) {
      if (!requireText(ctx)) return
      const quality = ctx.args.find(arg => qualities.has(arg)) || 'auto'
      const input = ctx.args.filter(arg => !qualities.has(arg)).join(' ')
      if (!input) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}mp4 ${ctx.plugin.usage}`)
      await download(ctx, '/downloader/mp4', { ...urlOrQuery(input), quality, direct: 'true' }, 'video')
    },
  },
  {
    commands: ['tiktok', 'tt'],
    category: 'downloader',
    description: 'Descarga un TikTok sin marca de agua.',
    usage: '<url>',
    async execute(ctx) {
      if (!isHttpUrl(ctx.text)) return searchResults(ctx, '/searcher/tiktok')
      await download(ctx, '/downloader/tiktok', { url: ctx.text, direct: 'mp4' }, 'video')
    },
  },
  {
    commands: ['tiktokaudio', 'ttaudio'],
    category: 'downloader',
    description: 'Extrae el audio de un TikTok.',
    usage: '<url>',
    async execute(ctx) {
      if (!requireUrl(ctx)) return
      await download(ctx, '/downloader/tiktok', { url: ctx.text, direct: 'mp3' }, 'audio')
    },
  },
  {
    commands: ['facebook', 'fb'],
    category: 'downloader',
    description: 'Descarga un video público de Facebook.',
    usage: '<url>',
    async execute(ctx) {
      if (!requireUrl(ctx)) return
      await download(ctx, '/downloader/facebook', { url: ctx.text, direct: 'mp4', quality: 'hd' }, 'video')
    },
  },
  {
    commands: ['instagram', 'ig'],
    category: 'downloader',
    description: 'Descarga una foto o reel de Instagram.',
    usage: '<url>',
    async execute(ctx) {
      if (!requireUrl(ctx)) return
      await download(ctx, '/downloader/instagram', { url: ctx.text, direct: 'true' }, 'auto')
    },
  },
  {
    commands: ['pindl', 'pinterestdl'],
    category: 'downloader',
    description: 'Descarga el archivo original de un pin.',
    usage: '<url>',
    async execute(ctx) {
      if (!requireUrl(ctx)) return
      const media = await ctx.api.media('/downloader/pinterest', { url: ctx.text, direct: 'true' })
      const kind = media.mimetype.startsWith('video/') ? 'video' : 'image'
      await ctx.send(mediaPayload(media, kind, `☾ ${ctx.config.botName}`))
    },
  },
  {
    commands: ['letra', 'lyrics', 'lyric'],
    category: 'downloader',
    description: 'Busca la letra de una canción.',
    usage: '<artista y canción>',
    async execute(ctx) {
      if (!requireText(ctx)) return
      await ctx.react('🎵')
      const song = await ctx.api.json('/downloader/lyric', { query: ctx.text })
      const lyrics = song.plainLyrics || song.syncedLyrics || song.lyrics || 'No se encontró la letra.'
      await ctx.reply(truncate(`☾ *${song.title || ctx.text}*\n> ${song.artist || song.author || ''}\n\n${lyrics}`, 14000))
    },
  },
]
