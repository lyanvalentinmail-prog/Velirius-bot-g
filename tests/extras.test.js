import test from 'node:test'
import assert from 'node:assert/strict'
import extraPlugins from '../plugins/extras.js'

const sender = '59811111111@s.whatsapp.net'
const plugin = name => extraPlugins.find(item => item.commands[0] === name)

function makeContext(users = {}) {
  const replies = []
  const ctx = {
    userKey: sender,
    usedPrefix: '.',
    args: [],
    text: '',
    db: { data: { users }, scheduleSave: () => {} },
    reply: async message => replies.push(message),
  }
  return { ctx, replies }
}

test('nota y delnota guardan y eliminan por número', async () => {
  const { ctx } = makeContext({ [sender]: {} })
  ctx.text = 'Primera nota'
  await plugin('nota').execute(ctx)
  ctx.text = 'Segunda nota'
  await plugin('nota').execute(ctx)
  const user = ctx.db.data.users[sender]
  assert.equal(user.notes.length, 2)
  ctx.args = ['1']
  await plugin('delnota').execute(ctx)
  assert.equal(user.notes.length, 1)
  assert.equal(user.notes[0].text, 'Segunda nota')
})

test('tops de actividad ordenan en ambos sentidos', async () => {
  const { ctx, replies } = makeContext({
    [sender]: { name: 'Activo', messages: 20 },
    '59822222222@s.whatsapp.net': { name: 'Inactivo', messages: 2 },
  })
  await plugin('topactivos').execute(ctx)
  assert.match(replies[0], /1\. \*Activo\*/)
  await plugin('topinactivos').execute(ctx)
  assert.match(replies[1], /1\. \*Inactivo\*/)
})
