import test from 'node:test'
import assert from 'node:assert/strict'
import { MessageHandler } from '../src/handler.js'
import { PluginRegistry } from '../src/plugins.js'
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'

test('el handler ejecuta .menu y conserva el rol de moderador en el contexto', async () => {
  const registry = new PluginRegistry('./plugins')
  await registry.load()
  const sender = '59811111111@s.whatsapp.net'
  const config = normalizeConfig({
    ...DEFAULT_CONFIG,
    menuMode: 'text',
    autoRead: false,
    cooldownMs: 0,
    mods: ['59811111111'],
  })
  const sent = []
  let trackedCommand = ''
  const database = {
    data: { users: {}, chats: {}, stats: { commands: {}, totalCommands: 0 } },
    touchMessage() {},
    trackCommand(_m, command) { trackedCommand = command },
    scheduleSave() {},
  }
  const sock = {
    user: { id: '59899999999@s.whatsapp.net' },
    sendMessage: async (chat, content, options) => {
      sent.push({ chat, content, options })
      return { key: { id: `sent-${sent.length}` } }
    },
  }
  const handler = new MessageHandler({
    registry,
    configStore: { data: config },
    database,
    startedAt: Date.now() - 1000,
  })

  await handler.handle(sock, {
    key: { id: 'menu-request', remoteJid: sender, fromMe: false },
    pushName: 'Moderador',
    message: { conversation: '.menu' },
  })

  assert.equal(trackedCommand, 'menu')
  assert.equal(sent.length, 2)
  assert.match(sent[0].content.caption, /ROL: Moderador/)
  assert.match(sent[1].content.text, /MENÚ COMPLETO/)
  assert.ok(!sent.some(({ content }) => String(content.text || '').includes('isMod is not defined')))
})
