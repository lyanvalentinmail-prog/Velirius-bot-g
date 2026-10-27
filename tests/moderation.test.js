import test from 'node:test'
import assert from 'node:assert/strict'
import moderationPlugins from '../plugins/moderation.js'
import { ModerationEngine } from '../src/moderation.js'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'
import { chatData } from '../src/utils/chat.js'

const chatId = 'group@g.us'
const sender = '59811111111@s.whatsapp.net'
const target = '59822222222@s.whatsapp.net'
const plugin = name => moderationPlugins.find(item => item.commands[0] === name)

function makeContext() {
  const replies = []
  const configStore = {
    data: normalizeConfig({ ...DEFAULT_CONFIG, mods: [] }),
    async update(mutator) {
      const draft = structuredClone(this.data)
      await mutator(draft)
      this.data = normalizeConfig(draft)
      return this.data
    },
  }
  const ctx = {
    config: configStore.data,
    configStore,
    command: 'mod',
    usedPrefix: '.',
    args: [],
    text: '',
    m: { chat: chatId, sender, senderDisplay: sender, mentionedJid: [target], quoted: null },
    db: { data: { users: {}, chats: {} }, scheduleSave: () => {} },
    reply: async (message, extra = {}) => replies.push({ message, extra }),
  }
  return { ctx, configStore, replies }
}

test('mod agrega, lista y elimina moderadores', async () => {
  const { ctx, configStore, replies } = makeContext()
  await plugin('mod').execute(ctx)
  assert.deepEqual(configStore.data.mods, ['59822222222'])
  ctx.config = configStore.data
  ctx.args = ['lista']
  await plugin('mod').execute(ctx)
  assert.match(replies.at(-1).message, /59822222222/)
  ctx.args = ['del', '59822222222']
  await plugin('mod').execute(ctx)
  assert.deepEqual(configStore.data.mods, [])
})

test('warn, mute y sban actualizan las reglas del chat', async () => {
  const { ctx } = makeContext()
  await plugin('warn').execute(ctx)
  const chat = chatData(ctx.db, chatId)
  assert.equal(chat.warnings['59822222222'].count, 1)
  await plugin('mute').execute(ctx)
  assert.equal(chat.muted.length, 1)
  await plugin('delmute').execute(ctx)
  assert.equal(chat.muted.length, 0)

  ctx.m.quoted = { message: { stickerMessage: { fileSha256: Buffer.from('sticker') } } }
  await plugin('sban').execute(ctx)
  assert.equal(chat.bannedStickers.length, 1)
  await plugin('sban').execute(ctx)
  assert.equal(chat.bannedStickers.length, 0)
})

function messageForEngine() {
  return {
    chat: chatId,
    isGroup: true,
    fromMe: false,
    isOwner: false,
    sender,
    senderDisplay: sender,
    message: { imageMessage: { mimetype: 'image/jpeg' } },
    msgType: 'imageMessage',
    text: '',
    raw: { key: { id: 'message-1', remoteJid: chatId, participant: sender } },
  }
}

test('el motor anti elimina medios bloqueados y respeta administradores', async () => {
  const database = { data: { chats: {} } }
  const engine = new ModerationEngine(database)
  assert.equal(engine.hasRules(chatId), false)
  chatData(database, chatId).settings.welcome = true
  assert.equal(engine.hasRules(chatId), false)
  chatData(database, chatId).settings.antiimg = true
  assert.equal(engine.hasRules(chatId), true)
  const sent = []
  const sock = { sendMessage: async (chat, content) => sent.push({ chat, content }) }
  const m = messageForEngine()
  const loadGroup = async () => ({ isAdmin: false, isBotAdmin: true })
  assert.equal(await engine.enforce(sock, m, loadGroup), true)
  assert.deepEqual(sent[0].content.delete, m.raw.key)

  const adminContext = messageForEngine()
  assert.equal(await engine.enforce(sock, adminContext, async () => ({ isAdmin: true, isBotAdmin: true })), false)
})

test('antidelete recupera un mensaje que estaba en caché', async () => {
  const database = { data: { chats: {} } }
  chatData(database, chatId).settings.antidelete = true
  const engine = new ModerationEngine(database)
  const m = messageForEngine()
  engine.remember(m)
  const sent = []
  const sock = { sendMessage: async (chat, content) => sent.push({ chat, content }) }
  const handled = await engine.handleProtocol(sock, {
    key: { remoteJid: chatId, participant: sender },
    message: { protocolMessage: { type: 'REVOKE', key: m.raw.key } },
  })
  assert.equal(handled, true)
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1].content.forward, m.raw)
})
