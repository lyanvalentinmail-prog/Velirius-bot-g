import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { cleanNumber } from './format.js'

export function normalizeJid(value = '') {
  if (!value) return ''
  try {
    return jidNormalizedUser(String(value))
  } catch {
    return String(value)
  }
}

export function isLid(value = '') {
  return /@(?:hosted\.)?lid$/i.test(String(value))
}

export function isPhoneJid(value = '') {
  return /@(?:s\.whatsapp\.net|c\.us|hosted)$/i.test(String(value))
}

export function asPhoneJid(value = '') {
  const raw = String(value).trim()
  if (raw.includes('@')) return normalizeJid(raw)
  const number = cleanNumber(raw)
  return number ? `${number}@s.whatsapp.net` : ''
}

export function asLidJid(value = '') {
  const raw = String(value).trim()
  if (raw.includes('@')) return normalizeJid(raw)
  const number = cleanNumber(raw)
  return number ? `${number}@lid` : ''
}

export function sameUser(first, second) {
  const a = cleanNumber(first)
  const b = cleanNumber(second)
  return Boolean(a && b && a === b)
}

export function identityVariants(value) {
  const jid = normalizeJid(value)
  if (!jid) return []
  const number = cleanNumber(jid)
  const values = [jid]
  if (number) {
    if (isLid(jid)) values.push(`${number}@hosted.lid`)
    if (isPhoneJid(jid)) values.push(`${number}@hosted`)
  }
  return [...new Set(values)]
}

export function participantIdentities(participant = {}) {
  const values = [
    participant.id,
    participant.jid,
    participant.phoneNumber ? asPhoneJid(participant.phoneNumber) : '',
    participant.lid ? asLidJid(participant.lid) : '',
  ]
  return [...new Set(values.flatMap(identityVariants).filter(Boolean))]
}

export function findParticipant(participants = [], identities = []) {
  const candidates = new Set(identities.flatMap(identityVariants).filter(Boolean))
  const numbers = new Set([...candidates].map(cleanNumber).filter(Boolean))
  return participants.find(participant => {
    const own = participantIdentities(participant)
    return own.some(id => candidates.has(id) || numbers.has(cleanNumber(id)))
  }) || null
}

export function ownerIdentities(config) {
  const phoneOwners = (config.owners || []).flatMap(owner =>
    identityVariants(asPhoneJid(owner.number)))
  const lidOwners = (config.ownerLids || []).flatMap(lid =>
    identityVariants(asLidJid(lid)))
  return new Set([...phoneOwners, ...lidOwners])
}

export function hasOwnerIdentity(identities = [], config, fromMe = false) {
  if (fromMe) return true
  const owners = ownerIdentities(config)
  const ownerNumbers = new Set([...owners].map(cleanNumber).filter(Boolean))
  return identities.some(identity => {
    const jid = normalizeJid(identity)
    return owners.has(jid) || ownerNumbers.has(cleanNumber(jid))
  })
}

export function hasModIdentity(identities = [], config) {
  const mods = new Set((config.mods || []).map(cleanNumber).filter(Boolean))
  return identities.some(identity => mods.has(cleanNumber(identity)))
}
