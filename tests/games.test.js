import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import gamePlugins, { resetGames } from '../plugins/games.js'

const sender = '59811111111@s.whatsapp.net'
const plugin = name => gamePlugins.find(item => item.commands[0] === name)

function makeContext(users = {}) {
  const replies = []
  let clock = 1_000_000
  const ctx = {
    userKey: sender,
    usedPrefix: '.',
    args: [],
    text: '',
    m: { chat: 'group@g.us', sender, senderDisplay: sender, mentionedJid: [], quoted: null },
    db: { data: { users }, scheduleSave: () => {} },
    now: () => clock,
    random: () => 0.999999,
    reply: async message => replies.push(message),
  }
  return { ctx, replies, setNow: value => { clock = value } }
}

afterEach(() => resetGames())

test('dado y ppt usan el azar inyectable y pagan una victoria', async () => {
  const { ctx, replies } = makeContext({ [sender]: {} })
  await plugin('dado').execute(ctx)
  assert.match(replies.at(-1), /6/)
  ctx.args = ['piedra']
  await plugin('ppt').execute(ctx)
  assert.match(replies.at(-1), /Ganaste/)
  assert.equal(ctx.db.data.users[sender].coins, 1000)
})

test('pescar entrega recompensa y aplica enfriamiento', async () => {
  const { ctx, replies } = makeContext({ [sender]: {} })
  await plugin('pescar').execute(ctx)
  assert.equal(ctx.db.data.users[sender].coins, 1500)
  await plugin('pescar').execute(ctx)
  assert.equal(ctx.db.data.users[sender].coins, 1500)
  assert.match(replies.at(-1), /Espera/)
})

test('prestamo y pagar conservan la deuda hasta tener saldo', async () => {
  const { ctx } = makeContext({ [sender]: {} })
  ctx.args = ['1000', '5']
  await plugin('prestamo').execute(ctx)
  const user = ctx.db.data.users[sender]
  assert.equal(user.coins, 1000)
  assert.equal(user.loan.repayment, 1100)
  await plugin('pagar').execute(ctx)
  assert.ok(user.loan)
  user.coins = 1100
  await plugin('pagar').execute(ctx)
  assert.equal(user.coins, 0)
  assert.equal(user.loan, undefined)
})

test('adivinanza y ahorcado premian las respuestas correctas', async () => {
  const { ctx } = makeContext({ [sender]: {} })
  ctx.random = () => 0
  await plugin('adivinanza').execute(ctx)
  ctx.text = 'mapa'
  await plugin('adivinanza').execute(ctx)
  assert.equal(ctx.db.data.users[sender].coins, 2000)

  ctx.text = ''
  await plugin('ahorcado').execute(ctx)
  ctx.text = 'pikachu'
  await plugin('ahorcado').execute(ctx)
  assert.equal(ctx.db.data.users[sender].coins, 5000)
})
