import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { ConfigStore } from './src/config.js'
import { Database } from './src/database.js'
import { MessageHandler } from './src/handler.js'
import { PluginRegistry } from './src/plugins.js'
import { cleanNumber } from './src/utils/format.js'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(`✖ Velirius Bot necesita Node.js 20.9 o superior. Versión actual: ${process.version}`)
  process.exit(1)
}

const cli = parseArguments(process.argv.slice(2))
if (cli.help) {
  printHelp()
  process.exit(0)
}

const configStore = new ConfigStore()
const registry = new PluginRegistry('./plugins')
const database = new Database()
const startedAt = Date.now()
let sock = null
let stopping = false
let reconnectTimer = null
let reconnectAttempts = 0
let pairingTimer = null
let login = { method: cli.method, phone: cli.phone }
let state
let saveCreds
let baileysVersion
let logger

const runtime = {
  restart: () => shutdown(42),
}

const handler = new MessageHandler({
  registry,
  configStore,
  database,
  startedAt,
  runtime,
})

async function connect() {
  if (stopping) return
  const config = configStore.data
  const socketLogger = logger.child({ class: 'velirius-socket' })
  sock = makeWASocket({
    ...(baileysVersion ? { version: baileysVersion } : {}),
    logger: socketLogger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, socketLogger),
    },
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    qrTimeout: 60000,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 5,
    getMessage: async () => undefined,
  })

  const current = sock
  current.ev.on('creds.update', saveCreds)
  current.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const message of messages) {
      try {
        await handler.handle(current, message)
      } catch (error) {
        console.error(`✖ Error procesando un mensaje: ${error.stack || error.message}`)
      }
    }
  })

  current.ev.on('connection.update', update => {
    if (current !== sock) return
    if (update.qr && login.method === 'qr' && !state.creds.registered) {
      console.log('\n☾ Escanea este QR desde WhatsApp → Dispositivos vinculados → Vincular dispositivo:\n')
      qrcode.generate(update.qr, { small: true })
    }

    if (update.connection === 'open') {
      reconnectAttempts = 0
      const user = current.user?.name || current.user?.verifiedName || cleanNumber(current.user?.id) || 'WhatsApp'
      console.log(`\n✔ ${configStore.data.botName} conectado como ${user}`)
      console.log(`✔ Prefijo: ${configStore.data.prefix} · Plugins: ${registry.count}`)
      console.log(`✔ Escribe ${configStore.data.prefix}menu en WhatsApp para comenzar.\n`)
    }

    if (update.connection === 'close') {
      clearTimeout(pairingTimer)
      const statusCode = new Boom(update.lastDisconnect?.error)?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut
      console.error(`⚠ Conexión cerrada (${statusCode || 'desconocido'})`)
      current.ev.removeAllListeners()
      if (stopping) return

      if (loggedOut) {
        console.error('✖ La sesión fue cerrada. Elimina la carpeta sessions y vuelve a vincular el bot.')
        shutdown(0)
        return
      }
      if (!state.creds.registered) {
        console.error('✖ No se completó la vinculación. Ejecuta npm start e inténtalo otra vez.')
        shutdown(0)
        return
      }
      scheduleReconnect()
    }
  })

  if (!state.creds.registered && login.method === 'pairing') {
    pairingTimer = setTimeout(() => requestPairing(current, login.phone), 4000)
  }
}

async function requestPairing(socket, phone) {
  if (socket !== sock || stopping || state.creds.registered) return
  try {
    const code = await socket.requestPairingCode(phone)
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code
    console.log(`\n✔ CÓDIGO DE EMPAREJAMIENTO: ${formatted}`)
    console.log('  WhatsApp → Dispositivos vinculados → Vincular con número de teléfono.')
    console.log('  El código caduca; si ocurre, reinicia el bot para generar otro.\n')
  } catch (error) {
    console.error(`✖ No se pudo solicitar el código: ${error.message}`)
    console.error('  Revisa el número e inténtalo con npm start -- --pairing --phone=TUNUMERO')
  }
}

function scheduleReconnect() {
  if (stopping || reconnectTimer) return
  reconnectAttempts += 1
  const delay = Math.min(30000, 1500 * 2 ** Math.min(reconnectAttempts, 5))
  console.log(`↻ Reconectando en ${Math.round(delay / 1000)} s…`)
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await connect()
    } catch (error) {
      console.error(`✖ Error al reconectar: ${error.message}`)
      scheduleReconnect()
    }
  }, delay)
}

async function chooseLogin() {
  if (state.creds.registered) {
    login.method = 'qr'
    return
  }
  if (!login.method && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      console.log('\nSelecciona la vinculación:\n  1) Código QR\n  2) Código de emparejamiento')
      const answer = (await rl.question('Opción [1/2, Enter = 1]: ')).trim()
      login.method = answer === '2' || answer.toLowerCase() === 'code' ? 'pairing' : 'qr'
      if (login.method === 'pairing' && !login.phone) {
        login.phone = cleanNumber(await rl.question('Número con código de país (ej. 59896719709): '))
      }
    } finally {
      rl.close()
    }
  }
  login.method ||= 'qr'
  if (login.method === 'pairing') {
    login.phone = cleanNumber(login.phone)
    if (login.phone.length < 8 || login.phone.length > 15) {
      throw new Error('Para pairing indica --phone=NUMERO con código de país, sin + ni espacios')
    }
  }
}

async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  clearTimeout(reconnectTimer)
  clearTimeout(pairingTimer)
  try {
    await database.save()
    await configStore.close()
    sock?.end?.(new Error('Velirius Bot detenido'))
  } catch (error) {
    console.error(`⚠ Error al cerrar: ${error.message}`)
  } finally {
    process.exit(code)
  }
}

async function main() {
  console.log(`\n\x1b[35m𓂃 ࣪ ִֶָ☾. VELIRIUS BOT\x1b[0m`)
  console.log('  WhatsApp Multi Device · Baileys · Termux\n')
  await configStore.init()
  await registry.load()
  await database.init()

  const sessionDir = path.resolve(configStore.data.sessionDir)
  await mkdir(sessionDir, { recursive: true, mode: 0o700 })
  logger = pino({ level: configStore.data.logLevel })
  ;({ state, saveCreds } = await useMultiFileAuthState(sessionDir))
  await chooseLogin()

  try {
    const latest = await fetchLatestBaileysVersion()
    baileysVersion = latest.version
    console.log(`☾ Versión de WhatsApp Web: ${baileysVersion.join('.')}`)
  } catch {
    console.warn('⚠ No se pudo consultar la última versión; Baileys usará su valor predeterminado.')
  }

  configStore.on('change', config => {
    logger.level = config.logLevel
    console.log(`☾ Configuración activa: prefijo=${config.prefix} · menú=${config.menuMode}`)
  })

  await connect()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('unhandledRejection', error => {
  console.error(`✖ Promesa no controlada: ${error?.stack || error}`)
})

main().catch(error => {
  console.error(`✖ No se pudo iniciar: ${error.stack || error.message}`)
  process.exit(1)
})

function parseArguments(args) {
  const result = { method: '', phone: process.env.PAIRING_NUMBER || '', help: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') result.help = true
    else if (arg === '--qr') result.method = 'qr'
    else if (arg === '--pairing' || arg === '--code') result.method = 'pairing'
    else if (arg.startsWith('--phone=')) result.phone = arg.slice(8)
    else if (arg === '--phone' && args[index + 1]) result.phone = args[++index]
  }
  return result
}

function printHelp() {
  console.log(`Velirius Bot · Baileys para Termux

Uso:
  npm start                         Elegir vinculación interactiva
  npm start -- --qr                 Mostrar código QR
  npm start -- --pairing --phone=59896719709
                                    Usar código de emparejamiento

Configuración:
  npm run setup                     Asistente para editar config.json
  nano config.json                  Edición manual (se recarga sola)
`)
}
