import { ensureEconomyUser, randomFrom } from '../src/utils/economy.js'
import { cleanNumber, truncate } from '../src/utils/format.js'
import { downloadMessageMedia, mediaPayload } from '../src/utils/media.js'

function activityTop(ctx, descending) {
  return Object.entries(ctx.db.data.users).map(([jid, user]) => ({
    jid,
    name: user.name || 'Usuario',
    messages: Number(user.messages) || 0,
  })).sort((a, b) => descending ? b.messages - a.messages : a.messages - b.messages).slice(0, 10)
}

export default [
  {
    commands: ['nota'],
    category: 'additional',
    description: 'Guarda una nota personal.',
    usage: '<contenido>',
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Usa *${ctx.usedPrefix}nota <contenido>*.`)
      const user = ensureEconomyUser(ctx)
      user.notes ||= []
      if (user.notes.length >= 50) return ctx.reply('☾ Ya tienes 50 notas; elimina una antes de agregar otra.')
      user.notes.push({ text: truncate(ctx.text, 500), createdAt: new Date().toISOString() })
      ctx.db.scheduleSave()
      await ctx.reply(`☾ Nota *${user.notes.length}* guardada.\n> ${user.notes.at(-1).text}`)
    },
  },
  {
    commands: ['delnota'],
    category: 'additional',
    description: 'Elimina una nota personal por número.',
    usage: '<número>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      const index = Number(ctx.args[0]) - 1
      if (!Number.isInteger(index) || index < 0 || index >= (user.notes?.length || 0)) {
        return ctx.reply(`☾ Usa *${ctx.usedPrefix}delnota <número válido>*.`)
      }
      const [removed] = user.notes.splice(index, 1)
      ctx.db.scheduleSave()
      await ctx.reply(`☾ Nota eliminada: *${removed.text}*`)
    },
  },
  {
    commands: ['reveal'],
    category: 'additional',
    description: 'Vuelve a enviar un medio de una sola vista.',
    usage: '<responder>',
    async execute(ctx) {
      if (!ctx.m.quoted) return ctx.reply(`☾ Responde a una imagen, video o audio con *${ctx.usedPrefix}reveal*.`)
      const media = await downloadMessageMedia(ctx.m, {
        types: ['image', 'video', 'audio'],
        maxBytes: 32 * 1024 * 1024,
      })
      if (!media) return ctx.reply('☾ No se encontró un medio compatible en el mensaje respondido.')
      await ctx.send(mediaPayload(media, media.type, '☾ Medio revelado'))
    },
  },
  {
    commands: ['topactivos'],
    category: 'tops',
    description: 'Muestra los usuarios con más mensajes.',
    async execute(ctx) {
      const users = activityTop(ctx, true).filter(user => user.messages > 0)
      if (!users.length) return ctx.reply('☾ Todavía no hay actividad registrada.')
      await ctx.reply(`🏆 *TOP ACTIVOS*\n${users.map((user, index) => `> ${index + 1}. *${user.name}* · ${user.messages} mensajes`).join('\n')}`)
    },
  },
  {
    commands: ['topinactivos'],
    category: 'tops',
    description: 'Muestra los usuarios con menos mensajes.',
    async execute(ctx) {
      const users = activityTop(ctx, false)
      if (!users.length) return ctx.reply('☾ Todavía no hay actividad registrada.')
      await ctx.reply(`🏆 *TOP INACTIVOS*\n${users.map((user, index) => `> ${index + 1}. *${user.name}* · ${user.messages} mensajes`).join('\n')}`)
    },
  },
  {
    commands: ['meme'],
    category: 'diversion',
    description: 'Busca un meme seguro en Pinterest.',
    async execute(ctx) {
      const result = await ctx.api.json('/searcher/pinterest', { query: 'memes español graciosos aptos para todos', limit: 10 })
      const items = (result?.results || result?.items || result?.data || (Array.isArray(result) ? result : []))
        .filter(item => item?.image || item?.thumbnail)
      if (!items.length) return ctx.reply('☾ No encontré memes en este momento.')
      const item = items[Math.floor(randomFrom(ctx) * items.length)] || items[0]
      await ctx.send({ image: { url: item.image || item.thumbnail }, caption: '😂 Meme · Velirius API' })
    },
  },
]
