import { asPhoneJid, findParticipant, identityVariants, normalizeJid } from './jid.js'
import { cleanNumber } from './format.js'

export async function groupContext(sock, m) {
  if (!m.isGroup) {
    return { metadata: null, participants: [], isAdmin: false, isBotAdmin: false }
  }
  const metadata = await sock.groupMetadata(m.chat)
  const participants = metadata?.participants || []
  const sender = findParticipant(participants, m.identities)
  const botIdentities = [
    sock.user?.id,
    sock.user?.jid,
    sock.user?.lid,
    sock.user?.phoneNumber,
  ].filter(Boolean).flatMap(identityVariants)
  const bot = findParticipant(participants, botIdentities)
  return {
    metadata,
    participants,
    senderParticipant: sender,
    botParticipant: bot,
    isAdmin: sender?.admin === 'admin' || sender?.admin === 'superadmin',
    isBotAdmin: bot?.admin === 'admin' || bot?.admin === 'superadmin',
  }
}

export function requestedTargets(ctx, { quoted = true, text = true } = {}) {
  let targets = [...ctx.m.mentionedJid]
  if (!targets.length && quoted && ctx.m.quoted?.sender) targets = [ctx.m.quoted.sender]
  if (!targets.length && text) {
    const value = ctx.args[0] || ctx.text.split(/\s+/)[0]
    const number = cleanNumber(value)
    if (number.length >= 8) targets = [asPhoneJid(number)]
  }
  return [...new Set(targets.map(normalizeJid).filter(Boolean))]
}

export function groupTarget(ctx, target) {
  const participant = findParticipant(ctx.participants, identityVariants(target))
  return participant?.id || normalizeJid(target)
}
