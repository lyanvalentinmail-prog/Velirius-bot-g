export function chatData(db, chatId) {
  const chat = db.data.chats[chatId] ||= { messages: 0, firstSeen: new Date().toISOString() }
  chat.settings ||= {}
  chat.warnings ||= {}
  chat.muted ||= []
  chat.badWords ||= []
  chat.bannedStickers ||= []
  return chat
}

export function saveChat(ctx, chat) {
  ctx.db.scheduleSave()
  return chat
}

export function settingOf(ctx, name, fallback = false) {
  return chatData(ctx.db, ctx.m.chat).settings[name] ?? fallback
}

export async function toggleChatSetting(ctx, name, label) {
  const raw = String(ctx.args[0] || '').toLowerCase()
  if (!['on', 'off'].includes(raw)) {
    await ctx.reply(`☾ Usa *${ctx.usedPrefix}${ctx.command} on/off*.`)
    return null
  }
  const chat = chatData(ctx.db, ctx.m.chat)
  chat.settings[name] = raw === 'on'
  saveChat(ctx, chat)
  await ctx.reply(`☾ ${label || name}: *${raw.toUpperCase()}*`)
  return chat.settings[name]
}
