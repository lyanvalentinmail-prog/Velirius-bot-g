import { isHttpUrl, truncate } from '../src/utils/format.js'
import { downloadMessageMedia, mediaPayload } from '../src/utils/media.js'

export default [
  {
    commands: ['calc', 'calculator', 'calculadora', 'calcular'],
    category: 'tools',
    description: 'Resuelve una expresión matemática.',
    usage: '<expresión>',
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}calc (2+3)*4^2`)
      const result = await ctx.api.json('/tools/calculator', { expr: ctx.text })
      await ctx.reply(`☾ *CALCULADORA*\n> Expresión: ${result.expression || ctx.text}\n> Resultado: *${result.result ?? result.value ?? 'Sin resultado'}*`)
    },
  },
  {
    commands: ['traducir', 'translate', 'tr'],
    category: 'tools',
    description: 'Traduce texto a otro idioma.',
    usage: '<idioma> <texto>',
    async execute(ctx) {
      const to = (ctx.args[0] || '').toLowerCase()
      const text = ctx.args.slice(1).join(' ') || ctx.m.quoted?.text || ''
      if (!/^[a-z]{2,5}$/i.test(to) || !text) {
        return ctx.reply(`☾ Uso: ${ctx.usedPrefix}traducir en Hola, ¿cómo estás?\nTambién puedes responder a un mensaje.`)
      }
      await ctx.react('🌐')
      const result = await ctx.api.json('/tools/translator', { text, to, from: 'auto' })
      await ctx.reply(truncate(`☾ *TRADUCCIÓN*\n> ${result.from || 'auto'} → ${result.to || to}\n\n${result.translatedText || result.text || result.result || JSON.stringify(result)}`, 10000))
    },
  },
  {
    commands: ['tts', 'voz', 'decir'],
    category: 'tools',
    description: 'Convierte texto a voz MP3.',
    usage: '[idioma] <texto>',
    async execute(ctx) {
      let lang = ctx.config.language || 'es'
      const args = [...ctx.args]
      if (args.length > 1 && /^[a-z]{2}$/i.test(args[0])) lang = args.shift().toLowerCase()
      const text = args.join(' ') || ctx.m.quoted?.text || ''
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}tts es Hola, soy Velirius Bot`)
      if (text.length > 3000) return ctx.reply('☾ El texto no puede superar 3000 caracteres.')
      await ctx.react('🎙️')
      const media = await ctx.api.media('/tools/tts', { text, lang, direct: 'true' })
      await ctx.send(mediaPayload(media, 'audio'))
    },
  },
  {
    commands: ['stt', 'speechtotext', 'transcribir'],
    category: 'tools',
    description: 'Transcribe un audio o nota de voz.',
    usage: '[idioma] [URL] (o responde a un audio)',
    async execute(ctx) {
      const lang = /^[a-z]{2}$/i.test(ctx.args[0] || '') ? ctx.args[0].toLowerCase() : (ctx.config.language || 'es')
      const url = ctx.args.find(isHttpUrl)
      let result
      await ctx.react('🎙️')
      if (url) {
        result = await ctx.api.json('/tools/stt', { url, lang }, { timeoutMs: 120000 })
      } else {
        const media = await downloadMessageMedia(ctx.m, {
          types: ['audio'],
          maxBytes: 16 * 1024 * 1024,
        })
        if (!media) {
          return ctx.reply(`☾ Responde a un audio con ${ctx.usedPrefix}stt o usa ${ctx.usedPrefix}stt <URL>`)
        }
        const mimetype = String(media.mimetype || 'audio/mpeg').split(';')[0]
        result = await ctx.api.request('/tools/stt', {
          method: 'POST',
          params: { lang },
          body: {
            audio: `data:${mimetype};base64,${media.buffer.toString('base64')}`,
            mime: mimetype,
            lang,
          },
          responseType: 'json',
          timeoutMs: 120000,
        })
      }
      const text = String(result?.text || '').trim()
      await ctx.reply(text
        ? truncate(`☾ *TRANSCRIPCIÓN*\n\n${text}\n\n> Proveedor: ${result.provider || 'Velirius API'}`, 14000)
        : '☾ No se detectó voz en el audio.')
    },
  },
  {
    commands: ['morse', 'codigomorse'],
    category: 'tools',
    description: 'Codifica o decodifica código Morse.',
    usage: '[decode] <texto>',
    async execute(ctx) {
      const decode = ['decode', 'decodificar', 'desencriptar'].includes((ctx.args[0] || '').toLowerCase())
      const text = decode ? ctx.args.slice(1).join(' ') : ctx.text
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}morse SOS\n${ctx.usedPrefix}morse decode ... --- ...`)
      const result = await ctx.api.json('/tools/morse', { text, mode: decode ? 'decode' : 'encode' })
      await ctx.reply(`☾ *MORSE (${decode ? 'decodificado' : 'codificado'})*\n${result.output || result.result || 'Sin resultado'}`)
    },
  },
]
