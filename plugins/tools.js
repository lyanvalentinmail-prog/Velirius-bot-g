import { truncate } from '../src/utils/format.js'
import { mediaPayload } from '../src/utils/media.js'

export default [
  {
    commands: ['calc', 'calculadora', 'calcular'],
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
      let lang = 'es'
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
