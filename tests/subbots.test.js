import test from 'node:test'
import assert from 'node:assert/strict'
import subbotPlugins from '../plugins/subbots.js'
import { SubbotManager } from '../src/subbots.js'

const plugin = name => subbotPlugins.find(item => item.commands[0] === name)

function makeContext({ lid = false } = {}) {
  const sender = lid ? '123456789012345@lid' : '59811111111@s.whatsapp.net'
  const starts = []
  const replies = []
  const ctx = {
    config: { botName: 'VELIRIUS BOT' },
    m: {
      chat: 'group@g.us',
      sender,
      senderPn: lid ? '' : sender,
      senderDisplay: sender,
    },
    sock: {},
    runtime: {
      subbots: {
        list: () => [],
        start: async options => starts.push(options),
      },
    },
    reply: async message => replies.push(message),
  }
  return { ctx, starts, replies }
}

test('qr crea una sesión y code exige un PN para emparejar', async () => {
  const { ctx, starts } = makeContext()
  await plugin('qr').execute(ctx)
  assert.equal(starts.length, 1)
  assert.equal(starts[0].method, 'qr')
  assert.equal(starts[0].requester, '59811111111@s.whatsapp.net')

  const lid = makeContext({ lid: true })
  await plugin('code').execute(lid.ctx)
  assert.equal(lid.starts.length, 0)
  assert.match(lid.replies.at(-1), /necesito tu número PN/)
  await plugin('qr').execute(lid.ctx)
  assert.equal(lid.starts[0].requester, '123456789012345@lid')
})

test('SubbotManager lista y detiene sesiones sin exponer credenciales', async () => {
  const manager = new SubbotManager({ handler: {}, sessionDir: '/tmp/velirius-subbot-test' })
  let stopped = false
  manager.sessions.set('59811111111', {
    id: '59811111111',
    requester: '59811111111@s.whatsapp.net',
    method: 'qr',
    status: 'open',
    pairingTimer: null,
    socket: {
      user: { name: 'Subbot' },
      ev: { removeAllListeners: () => {} },
      end: async () => { stopped = true },
    },
  })
  assert.equal(manager.list()[0].status, 'open')
  assert.equal(manager.list()[0].requester, '59811111111@s.whatsapp.net')
  await manager.stopAll()
  assert.equal(stopped, true)
  assert.equal(manager.list().length, 0)
})
