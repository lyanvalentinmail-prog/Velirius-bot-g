import { cleanNumber } from '../src/utils/format.js'
import { isPhoneJid, normalizeJid } from '../src/utils/jid.js'

async function startSubbot(ctx, method) {
  if (!ctx.runtime.subbots) return ctx.reply('☾ El gestor de subbots no está disponible.')
  const phone = ctx.m.senderPn || ctx.m.senderDisplay || ctx.m.sender
  if (method === 'code' && !isPhoneJid(phone)) {
    return ctx.reply('☾ Para vincular con código necesito tu número PN; usa QR si apareces como @lid.')
  }
  const requester = isPhoneJid(phone)
    ? `${cleanNumber(phone)}@s.whatsapp.net`
    : normalizeJid(ctx.m.sender)
  const existing = ctx.runtime.subbots.list().find(bot => bot.id === cleanNumber(requester))
  if (existing) return ctx.reply(`☾ Ya tienes un subbot ${existing.status === 'open' ? 'conectado' : 'en preparación'}.`)
  await ctx.reply(method === 'qr'
    ? '☾ Preparando tu subbot; recibirás el QR por privado.'
    : '☾ Preparando tu subbot; recibirás el código de emparejamiento por privado.')
  await ctx.runtime.subbots.start({
    parentSock: ctx.sock,
    chat: ctx.m.chat,
    requester,
    method,
  })
}

export default [
  {
    commands: ['qr'],
    category: 'subbot',
    description: 'Vincula un subbot mediante QR privado.',
    execute: ctx => startSubbot(ctx, 'qr'),
  },
  {
    commands: ['code'],
    category: 'subbot',
    description: 'Vincula un subbot mediante código privado.',
    execute: ctx => startSubbot(ctx, 'code'),
  },
  {
    commands: ['bots'],
    category: 'subbot',
    description: 'Lista los subbots activos o en preparación.',
    async execute(ctx) {
      const bots = ctx.runtime.subbots?.list?.() || []
      await ctx.reply(
        `☾ *BOTS VINCULADOS*\n> Principal: *${ctx.config.botName}* · conectado\n` +
        (bots.length
          ? bots.map((bot, index) => `> ${index + 1}. @${bot.id} · ${bot.status}${bot.user ? ` · ${bot.user}` : ''}`).join('\n')
          : '> No hay subbots adicionales.'),
        { contextInfo: { mentionedJid: bots.map(bot => bot.requester).filter(Boolean) } },
      )
    },
  },
]
