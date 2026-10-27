import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import makeWASocket, {
  Browsers,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import { cleanNumber } from './utils/format.js'
import { registerWelcome } from './utils/welcome.js'

export class SubbotManager {
  constructor({ handler, sessionDir, logLevel = 'silent' }) {
    this.handler = handler
    this.sessionDir = path.resolve(sessionDir, 'subbots')
    this.logger = pino({ level: logLevel })
    this.sessions = new Map()
  }

  async start({ parentSock, chat, requester, method }) {
    const id = cleanNumber(requester)
    if (!id) throw new Error('No se pudo identificar al usuario del subbot.')
    const existing = this.sessions.get(id)
    if (existing) return existing
    const directory = path.join(this.sessionDir, id)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const { state, saveCreds } = await useMultiFileAuthState(directory)
    const entry = {
      id,
      requester,
      method,
      directory,
      status: 'starting',
      socket: null,
      pairingTimer: null,
      lastQrAt: 0,
      stopping: false,
    }
    this.sessions.set(id, entry)
    try {
      const logger = this.logger.child({ class: 'velirius-subbot', id })
      const socket = makeWASocket({
        logger,
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        qrTimeout: 60000,
        getMessage: async () => undefined,
      })
      entry.socket = socket
      socket.ev.on('creds.update', saveCreds)
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const message of messages) {
          try {
            await this.handler.handle(socket, message)
          } catch (error) {
            console.error(`✖ [Subbot ${id}] ${error.message}`)
          }
        }
      })
      registerWelcome(socket, this.handler.database)
      socket.ev.on('connection.update', update => {
        this.#connectionUpdate(entry, parentSock, chat, update).catch(error => {
          console.error(`✖ [Subbot ${id}] ${error.message}`)
        })
      })
      if (method === 'code' && !state.creds.registered) {
        entry.pairingTimer = setTimeout(() => {
          this.#sendPairingCode(entry, parentSock).catch(error => {
            parentSock.sendMessage(requester, { text: `☾ No se pudo generar el código: ${error.message}` }).catch(() => {})
          })
        }, 4000)
        entry.pairingTimer.unref?.()
      }
      return entry
    } catch (error) {
      this.sessions.delete(id)
      throw error
    }
  }

  async #sendPairingCode(entry, parentSock) {
    if (entry.stopping || !entry.socket) return
    const code = await entry.socket.requestPairingCode(entry.id)
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code
    await parentSock.sendMessage(entry.requester, {
      text: `☾ *CÓDIGO DE SUBBOT*\n\n*${formatted}*\n\nWhatsApp → Dispositivos vinculados → Vincular con número de teléfono.`,
    })
  }

  async #connectionUpdate(entry, parentSock, chat, update) {
    if (entry.stopping) return
    if (update.qr && entry.method === 'qr' && Date.now() - entry.lastQrAt > 15000) {
      entry.lastQrAt = Date.now()
      const image = await QRCode.toBuffer(update.qr, { type: 'png', width: 512, margin: 1 })
      await parentSock.sendMessage(entry.requester, {
        image,
        caption: '☾ Escanea este QR para vincular tu subbot. Caduca rápidamente; no lo compartas.',
      })
    }
    if (update.connection === 'open') {
      entry.status = 'open'
      clearTimeout(entry.pairingTimer)
      await parentSock.sendMessage(chat, { text: `☾ Subbot de @${entry.id} conectado.`, contextInfo: { mentionedJid: [entry.requester] } })
    }
    if (update.connection === 'close') {
      entry.status = 'closed'
      clearTimeout(entry.pairingTimer)
      entry.socket?.ev?.removeAllListeners?.()
      this.sessions.delete(entry.id)
      if (!entry.stopping) {
        await parentSock.sendMessage(chat, { text: '☾ Subbot desconectado. Puedes volver a vincularlo con qr o code.' }).catch(() => {})
      }
    }
  }

  list() {
    return [...this.sessions.values()].map(entry => ({
      id: entry.id,
      requester: entry.requester,
      status: entry.status,
      method: entry.method,
      user: entry.socket?.user?.name || entry.socket?.user?.verifiedName || '',
    }))
  }

  async stopAll() {
    const entries = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.all(entries.map(async entry => {
      entry.stopping = true
      clearTimeout(entry.pairingTimer)
      entry.socket?.ev?.removeAllListeners?.()
      await entry.socket?.end?.(new Error('Subbots detenidos'))
    }))
  }
}
