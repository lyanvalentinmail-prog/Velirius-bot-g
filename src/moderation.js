import { chatData } from './utils/chat.js'
import { cleanNumber } from './utils/format.js'
import { normalizeJid, sameUser } from './utils/jid.js'

const MEDIA_RULES = {
  antiimg: 'imageMessage',
  antivideo: 'videoMessage',
  antiaudio: 'audioMessage',
  antisticker: 'stickerMessage',
  antidocs: 'documentMessage',
}
const AUTOMATIC_RULES = [...Object.keys(MEDIA_RULES), 'antilink', 'antipalabras', 'antispam', 'antibot']
const CACHE_SIZE = 120
const SPAM_WINDOW = 4000
const SPAM_LIMIT = 5

export function stickerHash(node) {
  if (node?.fileSha256) return Buffer.from(node.fileSha256).toString('base64')
  return ''
}

export class ModerationEngine {
  constructor(database) {
    this.database = database
    this.messages = new Map()
    this.spam = new Map()
  }

  remember(m) {
    if (!m.chat || !m.raw?.key?.id || !m.isGroup) return
    const chat = this.messages.get(m.chat) || new Map()
    chat.set(m.raw.key.id, { raw: m.raw, sender: m.senderDisplay || m.sender, at: Date.now() })
    while (chat.size > CACHE_SIZE) chat.delete(chat.keys().next().value)
    this.messages.set(m.chat, chat)
  }

  hasRules(chatId) {
    const chat = chatData(this.database, chatId)
    return chat.settings.enabled === false || chat.settings.soloAdmin || chat.muted.length > 0 ||
      chat.bannedStickers.length > 0 || AUTOMATIC_RULES.some(rule => chat.settings[rule])
  }

  async enforce(sock, m, loadGroup) {
    if (!m.isGroup || m.fromMe || !this.hasRules(m.chat)) return false
    const chat = chatData(this.database, m.chat)
    const group = await loadGroup()
    if (m.isOwner || group.isAdmin) return false
    const settings = chat.settings
    if (settings.enabled === false || settings.soloAdmin) return true

    const sender = cleanNumber(m.senderDisplay || m.sender)
    const muted = chat.muted.some(jid => sameUser(jid, m.senderDisplay || m.sender))
    let reason = muted ? 'mute' : ''
    if (!reason) {
      for (const [setting, type] of Object.entries(MEDIA_RULES)) {
        if (settings[setting] && m.message?.[type]) {
          reason = setting
          break
        }
      }
    }
    if (!reason && settings.antilink && /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(m.text)) reason = 'antilink'
    if (!reason && settings.antipalabras && chat.badWords.some(word => m.text.toLowerCase().includes(String(word).toLowerCase()))) {
      reason = 'antipalabras'
    }
    if (!reason && m.msgType === 'stickerMessage') {
      const hash = stickerHash(m.message?.stickerMessage)
      if (hash && chat.bannedStickers.includes(hash)) reason = 'sban'
    }
    if (!reason && settings.antibot && (m.msgType === 'botInvokeMessage' || m.message?.botInvokeMessage)) reason = 'antibot'
    if (!reason && settings.antispam) {
      const key = `${m.chat}:${sender}`
      const now = Date.now()
      const recent = (this.spam.get(key) || []).filter(at => now - at < SPAM_WINDOW)
      recent.push(now)
      this.spam.set(key, recent)
      if (recent.length > SPAM_LIMIT) reason = 'antispam'
    }
    if (!reason) return false
    if (group.isBotAdmin) {
      await sock.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {})
    }
    return true
  }

  async handleProtocol(sock, raw) {
    const protocol = raw?.message?.protocolMessage
    if (!protocol || !['REVOKE', 0].includes(protocol.type)) return false
    const chatId = normalizeJid(raw.key?.remoteJid)
    if (!chatId.endsWith('@g.us')) return false
    const chat = chatData(this.database, chatId)
    if (!chat.settings.antidelete) return false
    const deletedId = protocol.key?.id
    const cached = this.messages.get(chatId)?.get(deletedId)
    const sender = cached?.sender || protocol.key?.participant || raw.key?.participant || ''
    await sock.sendMessage(chatId, {
      text: `☾ *ANTIDELETE*\n> @${cleanNumber(sender) || 'Usuario'} eliminó un mensaje${cached ? '' : ' (ya no estaba en caché)'}.`,
      contextInfo: { mentionedJid: sender ? [sender] : [] },
    })
    if (cached?.raw) await sock.sendMessage(chatId, { forward: cached.raw }).catch(() => {})
    return true
  }
}
