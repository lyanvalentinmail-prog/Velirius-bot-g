import { chatData, saveChat, toggleChatSetting } from '../src/utils/chat.js'
import { cleanNumber } from '../src/utils/format.js'
import { downloadMessageMedia } from '../src/utils/media.js'
import { asPhoneJid, normalizeJid, sameUser } from '../src/utils/jid.js'
import { stickerHash } from '../src/moderation.js'

function targetFrom(ctx, index = 0, { quoted = true } = {}) {
  const target = ctx.m.mentionedJid?.[0] || (quoted ? ctx.m.quoted?.sender : '') || asPhoneJid(ctx.args[index])
  return normalizeJid(target || '')
}

async function requireTarget(ctx, target, usage) {
  if (target) return false
  await ctx.reply(`☾ Usa *${ctx.usedPrefix}${ctx.command} ${usage}*.`)
  return true
}

function moderationCommand(commands, description, usage, execute, extra = {}) {
  return { commands, category: 'admins', description, usage, group: true, admin: true, execute, ...extra }
}

const antiDefinitions = [
  ['antilink', 'Enlaces'],
  ['antiimg', 'Imágenes'],
  ['antiaudio', 'Audios'],
  ['antivideo', 'Videos'],
  ['antisticker', 'Stickers'],
  ['antispam', 'Spam'],
  ['antibot', 'Bots'],
  ['antidelete', 'Mensajes eliminados'],
  ['antidocs', 'Documentos'],
  ['antipalabras', 'Palabras bloqueadas'],
]

export default [
  {
    commands: ['mod'],
    category: 'owners',
    description: 'Agrega, elimina o lista moderadores del bot.',
    usage: '<@usuario/número | del @usuario | lista>',
    owner: true,
    async execute(ctx) {
      const action = String(ctx.args[0] || '').toLowerCase()
      if (action === 'lista') {
        const mods = ctx.config.mods || []
        return ctx.reply(mods.length
          ? `☾ *MODERADORES*\n${mods.map((mod, index) => `> ${index + 1}. wa.me/${mod}`).join('\n')}`
          : '☾ No hay moderadores registrados.')
      }
      const deleting = action === 'del'
      const target = targetFrom(ctx, deleting ? 1 : 0)
      if (await requireTarget(ctx, target, deleting ? 'del @usuario' : '@usuario / número')) return
      const number = cleanNumber(target)
      await ctx.configStore.update(config => {
        config.mods ||= []
        if (deleting) config.mods = config.mods.filter(mod => mod !== number)
        else if (!config.mods.includes(number)) config.mods.push(number)
      })
      await ctx.reply(`☾ @${number} ${deleting ? 'eliminado de' : 'agregado a'} moderadores.`, {
        contextInfo: { mentionedJid: [target] },
      })
    },
  },
  moderationCommand(['sban'], 'Bloquea o desbloquea un sticker respondido.', '<responder sticker>', async ctx => {
    const node = ctx.m.quoted?.message?.stickerMessage
    const hash = stickerHash(node)
    if (!hash) return ctx.reply(`☾ Responde a un sticker con *${ctx.usedPrefix}sban*.`)
    const chat = chatData(ctx.db, ctx.m.chat)
    const index = chat.bannedStickers.indexOf(hash)
    if (index >= 0) chat.bannedStickers.splice(index, 1)
    else chat.bannedStickers.push(hash)
    saveChat(ctx, chat)
    await ctx.reply(`☾ Sticker ${index >= 0 ? 'desbloqueado' : 'bloqueado'} en este grupo.`)
  }),
  moderationCommand(['warn'], 'Registra una advertencia para un usuario.', '@usuario / responder', async ctx => {
    const target = targetFrom(ctx)
    if (await requireTarget(ctx, target, '@usuario / responder')) return
    const chat = chatData(ctx.db, ctx.m.chat)
    const key = cleanNumber(target)
    const warning = chat.warnings[key] ||= { jid: target, count: 0 }
    warning.jid = target
    warning.count += 1
    saveChat(ctx, chat)
    await ctx.reply(`⚠️ @${key} tiene *${warning.count}* ${warning.count === 1 ? 'advertencia' : 'advertencias'}.`, {
      contextInfo: { mentionedJid: [target] },
    })
  }),
  moderationCommand(['delwarn'], 'Elimina advertencias de un usuario o del grupo.', '[@usuario / responder]', async ctx => {
    const target = targetFrom(ctx)
    const chat = chatData(ctx.db, ctx.m.chat)
    if (target) delete chat.warnings[cleanNumber(target)]
    else chat.warnings = {}
    saveChat(ctx, chat)
    await ctx.reply(target ? `☾ Advertencias de @${cleanNumber(target)} eliminadas.` : '☾ Advertencias del grupo eliminadas.', {
      contextInfo: { mentionedJid: target ? [target] : [] },
    })
  }),
  {
    commands: ['warnings'],
    category: 'admins',
    description: 'Muestra las advertencias de un usuario.',
    usage: '[@usuario / responder]',
    group: true,
    async execute(ctx) {
      const target = targetFrom(ctx) || ctx.m.sender
      const warning = chatData(ctx.db, ctx.m.chat).warnings[cleanNumber(target)]
      await ctx.reply(`☾ @${cleanNumber(target)}: *${warning?.count || 0}* advertencias.`, {
        contextInfo: { mentionedJid: [target] },
      })
    },
  },
  moderationCommand(['mute'], 'Silencia los mensajes de un usuario.', '@usuario / responder', async ctx => {
    const target = targetFrom(ctx)
    if (await requireTarget(ctx, target, '@usuario / responder')) return
    const chat = chatData(ctx.db, ctx.m.chat)
    if (!chat.muted.some(jid => sameUser(jid, target))) chat.muted.push(target)
    saveChat(ctx, chat)
    await ctx.reply(`☾ @${cleanNumber(target)} quedó silenciado.`, { contextInfo: { mentionedJid: [target] } })
  }, { botAdmin: true }),
  moderationCommand(['delmute'], 'Quita el silencio de un usuario.', '@usuario / responder', async ctx => {
    const target = targetFrom(ctx)
    if (await requireTarget(ctx, target, '@usuario / responder')) return
    const chat = chatData(ctx.db, ctx.m.chat)
    chat.muted = chat.muted.filter(jid => !sameUser(jid, target))
    saveChat(ctx, chat)
    await ctx.reply(`☾ @${cleanNumber(target)} ya no está silenciado.`, { contextInfo: { mentionedJid: [target] } })
  }),
  moderationCommand(['fijar'], 'Fija el mensaje respondido durante 24 horas.', '<responder>', async ctx => {
    if (!ctx.m.quoted?.key?.id) return ctx.reply('☾ Responde al mensaje que quieres fijar.')
    await ctx.sock.sendMessage(ctx.m.chat, { pin: { type: 1, time: 86400, key: ctx.m.quoted.key } })
    await ctx.reply('☾ Mensaje fijado por 24 horas.')
  }, { botAdmin: true }),
  moderationCommand(['desfijar'], 'Desfija el mensaje respondido.', '<responder>', async ctx => {
    if (!ctx.m.quoted?.key?.id) return ctx.reply('☾ Responde al mensaje que quieres desfijar.')
    await ctx.sock.sendMessage(ctx.m.chat, { pin: { type: 0, key: ctx.m.quoted.key } })
    await ctx.reply('☾ Mensaje desfijado.')
  }, { botAdmin: true }),
  moderationCommand(['photogp'], 'Cambia la foto del grupo.', '<responder imagen>', async ctx => {
    const media = await downloadMessageMedia(ctx.m, { types: ['image'], maxBytes: 10 * 1024 * 1024 })
    if (!media) return ctx.reply(`☾ Responde a una imagen con *${ctx.usedPrefix}photogp*.`)
    await ctx.sock.updateProfilePicture(ctx.m.chat, media.buffer)
    await ctx.reply('☾ Foto del grupo actualizada.')
  }, { botAdmin: true }),
  moderationCommand(['grupo'], 'Activa o pausa el bot en el grupo.', '<on/off>', async ctx => {
    await toggleChatSetting(ctx, 'enabled', 'Bot del grupo')
  }),
  moderationCommand(['soloadmin'], 'Limita los comandos a administradores.', '<on/off>', async ctx => {
    await toggleChatSetting(ctx, 'soloAdmin', 'Modo sólo administradores')
  }),
  moderationCommand(['welcome'], 'Activa la bienvenida de nuevos miembros.', '<on/off>', async ctx => {
    await toggleChatSetting(ctx, 'welcome', 'Bienvenida')
  }),
  moderationCommand(['antipalabra'], 'Agrega o elimina palabras bloqueadas.', '<add/del> <palabra>', async ctx => {
    const action = String(ctx.args[0] || '').toLowerCase()
    const word = ctx.args.slice(1).join(' ').trim().toLowerCase()
    const chat = chatData(ctx.db, ctx.m.chat)
    if (!['add', 'del'].includes(action) || !word) {
      return ctx.reply(chat.badWords.length
        ? `☾ Palabras bloqueadas: *${chat.badWords.join(', ')}*\nUsa *${ctx.usedPrefix}antipalabra add/del <palabra>*.`
        : `☾ Usa *${ctx.usedPrefix}antipalabra add/del <palabra>*.`)
    }
    if (action === 'add' && !chat.badWords.includes(word)) chat.badWords.push(word)
    if (action === 'del') chat.badWords = chat.badWords.filter(item => item !== word)
    saveChat(ctx, chat)
    await ctx.reply(`☾ Palabra ${action === 'add' ? 'agregada' : 'eliminada'}: *${word}*.`)
  }),
  ...antiDefinitions.map(([command, label]) => moderationCommand(
    [command],
    `Activa o desactiva: ${label}.`,
    '<on/off>',
    async ctx => { await toggleChatSetting(ctx, command, label) },
  )),
]
