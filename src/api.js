import { errorMessage } from './utils/format.js'

export class ApiError extends Error {
  constructor(message, { status = 0, hint = '', url = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.hint = hint
    this.url = url
  }
}

export class MediaTooLargeError extends Error {
  constructor(maxBytes, url) {
    super(`El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB`)
    this.name = 'MediaTooLargeError'
    this.downloadUrl = url
  }
}

function payloadError(payload, status, url) {
  const message = payload?.error || payload?.message || `Velirius API respondió HTTP ${status}`
  const hint = payload?.hint ? `\n${payload.hint}` : ''
  return new ApiError(`${message}${hint}`, { status, url })
}

export class VeliriusAPI {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || 'https://velirius-api-sd8u.vercel.app').replace(/\/$/, '')
    this.timeoutMs = Number(options.timeoutMs) || 120000
    this.maxMediaBytes = (Number(options.maxMediaMB) || 64) * 1024 * 1024
  }

  url(route, params = {}) {
    const url = new URL(`${this.baseUrl}/${String(route).replace(/^\//, '')}`)
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  async request(route, {
    params = {},
    method = 'GET',
    body,
    responseType = 'json',
    timeoutMs = this.timeoutMs,
  } = {}) {
    const url = this.url(route, params)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let response

    try {
      try {
        response = await fetch(url, {
          method,
          headers: {
            Accept: responseType === 'media' ? '*/*' : 'application/json',
            'User-Agent': 'Velirius-WhatsApp-Bot/1.0 (Termux; Baileys)',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
          redirect: 'follow',
        })
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Velirius API tardó demasiado en responder', { url })
        }
        throw new ApiError(`No se pudo conectar con Velirius API: ${errorMessage(error)}`, { url })
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
      if (responseType === 'media' && response.ok && !contentType.includes('json')) {
        return await this.#readMedia(response, url, contentType)
      }

      let payload
      try {
        const text = await response.text()
        const looksJson = /^\s*(?:\{|\[)/.test(text)
        payload = contentType.includes('json') || looksJson ? JSON.parse(text) : text
      } catch {
        payload = null
      }

      if (!response.ok) throw payloadError(payload, response.status, url)
      if (payload?.status === false) throw payloadError(payload, response.status, url)
      if (responseType === 'text') return String(payload ?? '')
      if (responseType === 'media') {
        throw new ApiError('La API no devolvió un archivo multimedia válido', { url })
      }
      return payload?.result ?? payload
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Velirius API tardó demasiado en responder', { url })
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  json(route, params = {}, options = {}) {
    return this.request(route, { ...options, params, responseType: 'json' })
  }

  text(route, params = {}, options = {}) {
    return this.request(route, { ...options, params, responseType: 'text' })
  }

  media(route, params = {}, options = {}) {
    return this.request(route, { ...options, params, responseType: 'media' })
  }

  uploadImage(buffer, mimetype = 'image/jpeg') {
    const image = `data:${mimetype};base64,${Buffer.from(buffer).toString('base64')}`
    return this.request('/upload', {
      method: 'POST',
      body: { image },
      responseType: 'json',
    })
  }

  async #readMedia(response, requestUrl, contentType) {
    const maxBytes = this.maxMediaBytes
    const declared = Number(response.headers.get('content-length'))
    if (declared > maxBytes) {
      await response.body?.cancel().catch(() => {})
      throw new MediaTooLargeError(maxBytes, response.url || requestUrl)
    }

    const chunks = []
    let total = 0

    if (response.body?.getReader) {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          total += value.byteLength
          if (total > maxBytes) {
            await reader.cancel().catch(() => {})
            throw new MediaTooLargeError(maxBytes, response.url || requestUrl)
          }
          chunks.push(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
      }
    } else {
      const buffer = Buffer.from(await response.arrayBuffer())
      total = buffer.length
      if (total > maxBytes) throw new MediaTooLargeError(maxBytes, response.url || requestUrl)
      chunks.push(buffer)
    }

    if (!total) throw new ApiError('La API devolvió un archivo vacío', { url: requestUrl })
    return {
      buffer: Buffer.concat(chunks, total),
      mimetype: contentType || 'application/octet-stream',
      size: total,
      url: response.url || requestUrl,
      filename: filenameFromDisposition(response.headers.get('content-disposition')),
    }
  }
}

function filenameFromDisposition(disposition = '') {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '')
  return match?.[1] || ''
}
