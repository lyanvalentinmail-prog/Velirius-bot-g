import { sameUser } from './jid.js'

export function ensureEconomyUser(ctx, key = ctx.userKey) {
  const user = ctx.db.data.users[key] ||= {}
  if (!Number.isFinite(user.coins) || user.coins < 0) user.coins = 0
  if (!Number.isFinite(user.bancoDinero) || user.bancoDinero < 0) user.bancoDinero = 0
  return user
}

export function economyUserKey(users, jid) {
  return Object.keys(users).find(key => sameUser(key, jid)) || jid
}

export function walletOf(user) {
  return Math.max(0, Math.floor(Number(user?.coins) || 0))
}

export function bankOf(user) {
  return Math.max(0, Math.floor(Number(user?.bancoDinero) || 0))
}

export function totalCoinsOf(user) {
  return walletOf(user) + bankOf(user)
}

export function addCoins(user, amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  user.coins = walletOf(user) + value
  return user.coins
}

export function spendCoins(user, amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  if (!value || totalCoinsOf(user) < value) return false
  const wallet = walletOf(user)
  const fromWallet = Math.min(wallet, value)
  user.coins = wallet - fromWallet
  user.bancoDinero = bankOf(user) - (value - fromWallet)
  return true
}

export function formatCoins(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('es-ES')
}

export function parseCoins(value) {
  const raw = String(value ?? '').trim().replace(/[.,\s]/g, '')
  if (!/^\d+$/.test(raw)) return 0
  const amount = Number(raw)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0
}

export function nowFrom(ctx) {
  return typeof ctx.now === 'function' ? ctx.now() : Date.now()
}

export function randomFrom(ctx) {
  return typeof ctx.random === 'function' ? ctx.random() : Math.random()
}

export function remainingTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', `${rest}s`]
    .filter(Boolean).join(' ')
}
