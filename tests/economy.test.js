import test from 'node:test'
import assert from 'node:assert/strict'
import economyPlugins from '../plugins/economy.js'

const sender = '59811111111@s.whatsapp.net'
const target = '59822222222@s.whatsapp.net'
const plugin = name => economyPlugins.find(item => item.commands[0] === name)

function makeContext(users = {}, randomValues = []) {
  const replies = []
  let saves = 0
  let clock = 1_000_000
  const ctx = {
    userKey: sender,
    usedPrefix: '.',
    args: [],
    text: '',
    m: { sender, senderDisplay: sender, mentionedJid: [], quoted: null },
    db: { data: { users }, scheduleSave: () => { saves += 1 } },
    now: () => clock,
    random: () => randomValues.length ? randomValues.shift() : 0,
    reply: async (message, extra = {}) => replies.push({ message, extra }),
  }
  return {
    ctx,
    replies,
    saves: () => saves,
    setNow: value => { clock = value },
  }
}

test('daily mantiene racha, enfriamiento y reinicio por atraso', async () => {
  const { ctx, replies, saves, setNow } = makeContext({ [sender]: {} })
  const user = ctx.db.data.users[sender]
  await plugin('daily').execute(ctx)
  assert.equal(user.coins, 9000)
  assert.equal(user.dailyStreak, 1)

  await plugin('daily').execute(ctx)
  assert.equal(user.coins, 9000)
  assert.match(replies.at(-1).message, /Ya reclamaste/)

  setNow(1_000_000 + 24 * 60 * 60 * 1000 + 30000)
  await plugin('daily').execute(ctx)
  assert.equal(user.coins, 18500)
  assert.equal(user.dailyStreak, 2)

  setNow(1_000_000 + 2 * 24 * 60 * 60 * 1000 + 91000)
  await plugin('daily').execute(ctx)
  assert.equal(user.dailyStreak, 1)
  assert.equal(user.coins, 27500)
  assert.equal(saves(), 3)
})

test('work aplica enfriamiento y transf mueve coins sin permitir sobregiro', async () => {
  const { ctx, replies } = makeContext({ [sender]: { coins: 1000 }, [target]: {} })
  const users = ctx.db.data.users
  await plugin('work').execute(ctx)
  assert.equal(users[sender].coins, 1600)
  assert.match(replies.at(-1).message, /\+600 coins/)
  await plugin('work').execute(ctx)
  assert.equal(users[sender].coins, 1600)
  assert.match(replies.at(-1).message, /Debes esperar/)

  ctx.m.mentionedJid = [target]
  ctx.args = ['@59822222222', '500']
  await plugin('transf').execute(ctx)
  assert.equal(users[sender].coins, 1100)
  assert.equal(users[target].coins, 500)

  ctx.args = ['@59822222222', '5000']
  await plugin('transf').execute(ctx)
  assert.equal(users[sender].coins, 1100)
  assert.equal(users[target].coins, 500)
  assert.match(replies.at(-1).message, /No tienes suficientes/)
})

test('banco permite unirse, depositar, retirar y cambiar con costo', async () => {
  const { ctx } = makeContext({ [sender]: { coins: 1000 } })
  const user = ctx.db.data.users[sender]
  ctx.args = ['konoha']
  await plugin('unirsebank').execute(ctx)
  assert.equal(user.banco, 'konoha')

  ctx.args = ['400']
  await plugin('deposit').execute(ctx)
  assert.equal(user.coins, 600)
  assert.equal(user.bancoDinero, 400)

  ctx.args = ['100']
  await plugin('withdraw').execute(ctx)
  assert.equal(user.coins, 700)
  assert.equal(user.bancoDinero, 300)

  ctx.args = ['akatsuki']
  await plugin('change').execute(ctx)
  assert.equal(user.banco, 'akatsuki')
  assert.equal(user.coins, 350)
  assert.equal(user.bancoDinero, 300)
})

test('topcoins suma cartera y banco', async () => {
  const { ctx, replies } = makeContext({
    [sender]: { name: 'Lyann', coins: 100, bancoDinero: 900 },
    [target]: { name: 'Usuario', coins: 500, bancoDinero: 0 },
  })
  await plugin('topcoins').execute(ctx)
  assert.match(replies[0].message, /1\. \*Lyann\* · 1000 coins/)
  assert.match(replies[0].message, /2\. \*Usuario\* · 500 coins/)
})
