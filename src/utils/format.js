import os from 'node:os'

export function normalizeCommand(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function cleanNumber(value = '') {
  return String(value).split('@')[0].split(':')[0].replace(/\D/g, '')
}

export function formatUptime(milliseconds) {
  const total = Math.max(0, Math.floor(Number(milliseconds) / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours || parts.length) parts.push(`${hours}h`)
  if (minutes || parts.length) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** index
  return `${amount.toFixed(index > 1 && amount < 10 ? 1 : 0)} ${units[index]}`
}

export function memoryUsage() {
  return `${formatBytes(process.memoryUsage().rss)} / ${formatBytes(os.totalmem())}`
}

export function truncate(value, max = 3500) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

export function isHttpUrl(value = '') {
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function urlOrQuery(text = '') {
  const value = String(text).trim()
  return isHttpUrl(value) ? { url: value } : { query: value }
}

export function asArray(value) {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  return [value]
}

export function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

export function errorMessage(error) {
  if (!error) return 'Error desconocido'
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return 'La API tardó demasiado en responder. Inténtalo de nuevo.'
  }
  return String(error.message || error).slice(0, 500)
}
