import { VeliriusAPI, ApiError, MediaTooLargeError } from './api.js'
import { categoryFromSelection } from './menu.js'
import { ModerationEngine } from './moderation.js'
import { errorMessage, truncate } from './utils/format.js'
import { groupContext } from './utils/group.js'
import { hasModIdentity } from './utils/jid.js'
import { parseCommandText, serializeMessage } from './utils/messages.js'

export class MessageHandler {
  constructor({ registry, configStore, database, startedAt, runtime = {} }) {
    this.registry = registry
    this.configStore = configStore
    this.database = database
    this.startedAt = startedAt
    this.runtime = runtime
    this.cooldowns = new Map()
    this.groupCache = new Map()
    this.moderation = new ModerationEngine(database)
  }

  async handle(sock, raw) {
    if (!raw?.message || !raw.key?.remoteJid) return
    if (raw.key.remoteJid === 'status@broadcast' || raw.key.remoteJid.endsWith('@newsletter')) return
    if (raw.message.protocolMessage) return this.moderation.handleProtocol(sock, raw)
    if (raw.message.senderKeyDistributionMessage) return

    const config = this.configStore.data
    const m = await serializeMessage(sock, raw, config)
    if (!m.chat) return
    this.moderation.remember(m)
    if (m.isGroup && this.moderation.hasRules(m.chat)) {
      const enforced = await this.moderation.enforce(sock, m, () => this.#groupContext(sock, m))
      if (enforced) return
    }
    if (!m.text && !m.selectionId) return

    this.database.touchMessage(m)
    if (config.autoRead && !m.fromMe) {
      sock.readMessages([raw.key]).catch(() => {})
    }

    const selectedCategory = categoryFromSelection(m.selectionId)
    const parsed = selectedCategory
      ? { command: 'menu', args: [selectedCategory], text: selectedCategory, usedPrefix: config.prefix }
      : parseCommandText(m.text, config.prefix)
    if (!parsed) return

    const plugin = this.registry.get(parsed.command)
    if (!plugin) return
    const isMod = hasModIdentity(m.identities, config)
    if (config.mode === 'self' && !m.isOwner && !isMod) return

    const cooldownKey = `${m.senderDisplay}:${parsed.command}`
    const now = Date.now()
    if (!m.isOwner && now - (this.cooldowns.get(cooldownKey) || 0) < config.cooldownMs) return
    this.cooldowns.set(cooldownKey, now)

    try {
      let group = { metadata: null, participants: [], isAdmin: false, isBotAdmin: false }
      if (m.isGroup && (plugin.group || plugin.admin || plugin.botAdmin || plugin.needsGroupMetadata)) {
        group = await this.#groupContext(sock, m)
      }

      if (plugin.owner && !m.isOwner && !(plugin.mod && isMod)) {
        return this.#deny(sock, m, 'Este comando es sólo para owners o moderadores autorizados.')
      }
      if (plugin.group && !m.isGroup) return this.#deny(sock, m, 'Este comando sólo funciona en grupos.')
      if (plugin.private && m.isGroup) return this.#deny(sock, m, 'Usa este comando en el privado del bot.')
      if (plugin.admin && !m.isOwner && !isMod && !group.isAdmin) {
        return this.#deny(sock, m, 'Necesitas ser administrador del grupo.')
      }
      if (plugin.botAdmin && !group.isBotAdmin) {
        return this.#deny(sock, m, 'El bot necesita ser administrador del grupo.')
      }

      const ctx = this.#createContext(sock, m, plugin, parsed, group, config, isMod)
      this.database.trackCommand(m, plugin.commands[0])
      await plugin.execute(ctx)
    } catch (error) {
      await this.#handleError(sock, m, plugin, error)
    }
  }

  async #groupContext(sock, m) {
    const cached = this.groupCache.get(m.chat)
    if (cached && Date.now() - cached.at < 20000) return cached.value
    const value = await groupContext(sock, m)
    this.groupCache.set(m.chat, { at: Date.now(), value })
    return value
  }

  #createContext(sock, m, plugin, parsed, group, config, isMod) {
    const send = (content, options = {}) => sock.sendMessage(m.chat, content, { quoted: m.raw, ...options })
    const reply = (text, extra = {}) => send({ text: truncate(text, 60000), ...extra })
    return {
      sock,
      conn: sock,
      m,
      msg: m.raw,
      userKey: m.senderDisplay || m.sender,
      config,
      configStore: this.configStore,
      db: this.database,
      registry: this.registry,
      runtime: this.runtime,
      startedAt: this.startedAt,
      plugin,
      command: parsed.command,
      args: parsed.args,
      text: parsed.text,
      usedPrefix: parsed.usedPrefix,
      isOwner: m.isOwner,
      isMod,
      isGroup: m.isGroup,
      isAdmin: group.isAdmin,
      isBotAdmin: group.isBotAdmin,
      groupMetadata: group.metadata,
      participants: group.participants,
      api: new VeliriusAPI(config.api),
      send,
      reply,
      react: emoji => sock.sendMessage(m.chat, { react: { text: emoji, key: m.raw.key } }),
    }
  }

  async #deny(sock, m, text) {
    await sock.sendMessage(m.chat, { text: `☾ ${text}` }, { quoted: m.raw })
  }

  async #handleError(sock, m, plugin, error) {
    if (error instanceof MediaTooLargeError) {
      return sock.sendMessage(m.chat, {
        text: `☾ ${error.message}.${error.downloadUrl ? `\nDescarga directa:\n${error.downloadUrl}` : ''}`,
      }, { quoted: m.raw })
    }
    if (error instanceof ApiError) {
      console.error(`✖ [${plugin.commands[0]}] ${error.message}`)
      return sock.sendMessage(m.chat, { text: `☾ ${error.message}` }, { quoted: m.raw })
    }
    console.error(`✖ [${plugin.commands[0]}]`, error)
    await sock.sendMessage(m.chat, {
      text: `☾ No se pudo ejecutar el comando: ${errorMessage(error)}`,
    }, { quoted: m.raw }).catch(() => {})
  }
}
