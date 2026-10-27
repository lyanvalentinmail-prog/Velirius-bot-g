import { getContentType } from '@whiskeysockets/baileys'
import { normalizeCommand } from './format.js'
import { hasOwnerIdentity, isLid, isPhoneJid, normalizeJid } from './jid.js'

const WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
]

export function unwrapMessage(message) {
  let current = message || {}
  for (let depth = 0; depth < 10; depth += 1) {
    const wrapper = WRAPPERS.find(key => current?.[key]?.message)
    if (!wrapper) break
    current = current[wrapper].message
  }
  return current || {}
}

export function extractSelectionId(message) {
  const msg = unwrapMessage(message)
  const direct = msg.listResponseMessage?.singleSelectReply?.selectedRowId
    || msg.buttonsResponseMessage?.selectedButtonId
    || msg.templateButtonReplyMessage?.selectedId
  if (direct) return String(direct)

  const params = msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  if (!params) return ''
  try {
    const parsed = typeof params === 'string' ? JSON.parse(params) : params
    return String(parsed.id || parsed.selected_id || parsed.selectedRowId || parsed.rowId || '')
  } catch {
    return ''
  }
}

export function extractText(message) {
  const msg = unwrapMessage(message)
  const selection = extractSelectionId(msg)
  return String(
    msg.conversation
    || msg.extendedTextMessage?.text
    || msg.imageMessage?.caption
    || msg.videoMessage?.caption
    || msg.documentMessage?.caption
    || msg.buttonsResponseMessage?.selectedDisplayText
    || msg.listResponseMessage?.title
    || msg.interactiveResponseMessage?.body?.text
    || selection
    || '',
  )
}

export function parseCommandText(body, prefix = '.') {
  const value = String(body || '').trim()
  if (!value.startsWith(prefix)) return null
  const withoutPrefix = value.slice(prefix.length).trim()
  if (!withoutPrefix) return null
  const [rawCommand, ...args] = withoutPrefix.split(/\s+/)
  return {
    command: normalizeCommand(rawCommand),
    args,
    text: withoutPrefix.slice(rawCommand.length).trim(),
    usedPrefix: prefix,
  }
}

export function findContextInfo(message) {
  const msg = unwrapMessage(message)
  for (const value of Object.values(msg)) {
    if (value && typeof value === 'object' && value.contextInfo) return value.contextInfo
  }
  return null
}

async function resolvePhoneFromLid(sock, jid) {
  if (!isLid(jid)) return ''
  try {
    const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid)
    return mapped && isPhoneJid(mapped) ? normalizeJid(mapped) : ''
  } catch {
    return ''
  }
}

export async function serializeMessage(sock, raw, config) {
  const message = unwrapMessage(raw.message)
  const chat = normalizeJid(raw.key?.remoteJid)
  const isGroup = chat.endsWith('@g.us')
  const primary = normalizeJid(isGroup
    ? raw.key?.participant
    : raw.key?.fromMe ? (sock.user?.id || sock.user?.jid || chat) : chat)
  const alternate = normalizeJid(isGroup
    ? raw.key?.participantAlt
    : raw.key?.fromMe ? '' : raw.key?.remoteJidAlt)
  const identities = [...new Set([primary, alternate].filter(Boolean))]

  const mappedPhone = await resolvePhoneFromLid(sock, primary)
  if (mappedPhone) identities.push(mappedPhone)
  const senderPn = [alternate, mappedPhone, primary].find(isPhoneJid) || ''
  const senderDisplay = senderPn || primary
  const contextInfo = findContextInfo(message)
  const quotedMessage = contextInfo?.quotedMessage ? unwrapMessage(contextInfo.quotedMessage) : null
  const quotedSender = normalizeJid(contextInfo?.participant)

  return {
    raw,
    key: raw.key,
    message,
    msgType: getContentType(message) || '',
    chat,
    isGroup,
    sender: primary,
    senderPn,
    senderDisplay,
    identities,
    name: String(raw.pushName || 'Usuario').trim() || 'Usuario',
    text: extractText(message),
    selectionId: extractSelectionId(message),
    fromMe: Boolean(raw.key?.fromMe),
    isOwner: hasOwnerIdentity(identities, config, raw.key?.fromMe),
    mentionedJid: (contextInfo?.mentionedJid || []).map(normalizeJid).filter(Boolean),
    quoted: quotedMessage ? {
      message: quotedMessage,
      text: extractText(quotedMessage),
      sender: quotedSender,
      key: {
        remoteJid: chat,
        id: contextInfo.stanzaId,
        participant: quotedSender,
        fromMe: false,
      },
    } : null,
  }
}
