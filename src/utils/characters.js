import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const catalogPath = path.resolve(directory, '../../assets/characters.json')
const loaded = JSON.parse(readFileSync(catalogPath, 'utf8'))

export const characterCatalog = Object.freeze(loaded.filter(character =>
  character?.id && character?.name && character?.image && Number(character.price) > 0))

export const OFFER_TTL_MS = 2 * 60 * 1000
export const ROLL_COOLDOWN_MS = 35 * 1000
const offers = new Map()
const cooldowns = new Map()
const rollLocks = new Set()

export function pickCharacter(random = Math.random) {
  if (!characterCatalog.length) throw new Error('El catálogo de personajes está vacío.')
  const character = characterCatalog[Math.floor(random() * characterCatalog.length)] || characterCatalog[0]
  return { ...character }
}

export function collectionOf(user) {
  if (!Array.isArray(user.characters)) user.characters = []
  return user.characters
}

export function addCharacter(user, character) {
  const collection = collectionOf(user)
  const existing = collection.find(item => String(item.id) === String(character.id))
  if (existing) {
    existing.qty = Math.max(1, Number(existing.qty) || 1) + 1
    return existing
  }
  const owned = {
    id: String(character.id),
    name: character.name,
    anime: character.anime || 'Sin serie',
    image: character.image || '',
    imageAlt: character.imageAlt || '',
    rarity: character.rarity || 'common',
    rarityLabel: character.rarityLabel || 'Común',
    price: Math.max(0, Number(character.price) || 0),
    maxHp: Math.max(0, Number(character.maxHp) || 0),
    power: Math.max(0, Number(character.power) || 0),
    qty: 1,
    obtainedAt: Date.now(),
  }
  collection.push(owned)
  return owned
}

export function findCharacterIndex(user, query) {
  const collection = collectionOf(user)
  const wanted = String(query || '').trim().toLowerCase()
  if (!wanted) return -1
  if (/^\d+$/.test(wanted)) {
    const slot = Number(wanted) - 1
    if (slot >= 0 && slot < collection.length) return slot
  }
  const byId = collection.findIndex(character => String(character.id) === wanted)
  if (byId >= 0) return byId
  return collection.findIndex(character => String(character.name).toLowerCase().includes(wanted))
}

export function takeCharacter(user, index) {
  const collection = collectionOf(user)
  if (!Number.isInteger(index) || index < 0 || index >= collection.length) return null
  const owned = collection[index]
  const character = { ...owned }
  delete character.qty
  delete character.obtainedAt
  owned.qty = Math.max(0, (Number(owned.qty) || 1) - 1)
  if (!owned.qty) collection.splice(index, 1)
  return character
}

export function collectionUnits(user) {
  return collectionOf(user).reduce((total, character) => total + (Number(character.qty) || 1), 0)
}

export function collectionValue(user) {
  return collectionOf(user).reduce((total, character) =>
    total + (Number(character.price) || 0) * (Number(character.qty) || 1), 0)
}

export function characterShop(ctx) {
  const shop = ctx.db.data.charShop ||= { nextOrder: 1, listings: [] }
  if (!Array.isArray(shop.listings)) shop.listings = []
  if (!Number.isSafeInteger(shop.nextOrder) || shop.nextOrder < 1) shop.nextOrder = 1
  return shop
}

export function activeListings(ctx) {
  return characterShop(ctx).listings
    .filter(listing => listing?.status === 'active')
    .sort((a, b) => a.order - b.order)
}

export function pruneCharacterShop(ctx) {
  const shop = characterShop(ctx)
  const active = shop.listings.filter(listing => listing?.status === 'active')
  const history = shop.listings.filter(listing => listing && listing.status !== 'active')
    .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, 40)
  shop.listings = [...active, ...history]
}

export function beginCharacterRoll(userKey, now = Date.now()) {
  if (rollLocks.has(userKey)) return { ok: false, reason: 'busy', left: 1500 }
  const left = (cooldowns.get(userKey) || 0) + ROLL_COOLDOWN_MS - now
  if (left > 0) return { ok: false, reason: 'cooldown', left }
  rollLocks.add(userKey)
  cooldowns.set(userKey, now)
  return { ok: true }
}

export function endCharacterRoll(userKey) {
  rollLocks.delete(userKey)
}

export function setCharacterOffer(chat, character, rolledBy, now = Date.now()) {
  const offer = { character, rolledBy, expiresAt: now + OFFER_TTL_MS }
  offers.set(chat, offer)
  return offer
}

export function getCharacterOffer(chat, now = Date.now()) {
  const offer = offers.get(chat)
  if (!offer) return null
  if (now >= offer.expiresAt) {
    offers.delete(chat)
    return null
  }
  return offer
}

export function clearCharacterOffer(chat) {
  offers.delete(chat)
}

export function resetCharacterSessions() {
  offers.clear()
  cooldowns.clear()
  rollLocks.clear()
}
