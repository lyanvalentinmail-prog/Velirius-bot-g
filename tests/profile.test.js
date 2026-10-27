import test from 'node:test'
import assert from 'node:assert/strict'
import profilePlugins from '../plugins/profile.js'
import { DEFAULT_CONFIG } from '../src/config.js'
import { Database } from '../src/database.js'

const sender = '59811111111@s.whatsapp.net'
const target = '59822222222@s.whatsapp.net'
const plugin = name => profilePlugins.find(item => item.commands[0] === name)

function makeContext(users = {}) {
  const replies = []
  const sent = []
  let saves = 0
  const ctx = {
    userKey: sender,
    usedPrefix: '.',
    args: [],
    text: '',
    config: structuredClone(DEFAULT_CONFIG),
    isAdmin: false,
    now: () => Date.parse('2026-06-15T12:00:00Z'),
    m: {
      chat: 'chat@g.us',
      sender,
      senderDisplay: sender,
      name: 'Usuario',
      mentionedJid: [],
      quoted: null,
    },
    db: { data: { users }, scheduleSave: () => { saves += 1 } },
    sock: { profilePictureUrl: async () => '' },
    send: async payload => sent.push(payload),
    reply: async (message, extra = {}) => replies.push({ message, extra }),
  }
  return { ctx, replies, sent, saves: () => saves }
}

test('perfil guarda personalización y muestra los datos RPG', async () => {
  const { ctx, sent, saves } = makeContext({ [sender]: { coins: 500 } })
  const user = ctx.db.data.users[sender]
  ctx.text = 'Descripción de prueba'
  await plugin('setdesc').execute(ctx)
  ctx.text = 'Rem'
  await plugin('setfav').execute(ctx)
  ctx.text = 'Lyann'
  await plugin('setname').execute(ctx)
  ctx.args = ['mujer']
  await plugin('setgenre').execute(ctx)
  ctx.text = '15/06/2000'
  await plugin('setbirth').execute(ctx)

  assert.equal(user.desc, 'Descripción de prueba')
  assert.equal(user.favourite, 'Rem')
  assert.equal(user.name, 'Lyann')
  assert.equal(user.customName, true)
  assert.equal(user.genre, 'mujer')
  assert.equal(user.birth, '15/06/2000')
  assert.equal(saves(), 5)

  ctx.sock.profilePictureUrl = async () => 'https://example.com/profile.jpg'
  await plugin('perfil').execute(ctx)
  assert.equal(sent[0].image.url, 'https://example.com/profile.jpg')
  assert.match(sent[0].caption, /Descripción de prueba/)
  assert.match(sent[0].caption, /Favorito: Rem/)
  assert.match(sent[0].caption, /Coins: 500/)
})

test('birthdays filtra el día y allbirthdays conserva el calendario', async () => {
  const { ctx, replies } = makeContext({
    [sender]: { name: 'Lyann', birth: '15/06/2000' },
    [target]: { name: 'Otro', birth: '16/06' },
  })
  await plugin('birthdays').execute(ctx)
  assert.match(replies[0].message, /Lyann/)
  assert.doesNotMatch(replies[0].message, /Otro/)
  await plugin('allbirthdays').execute(ctx)
  assert.match(replies[1].message, /Lyann/)
  assert.match(replies[1].message, /Otro/)
})

test('setage, marry y divorce actualizan ambos perfiles', async () => {
  const { ctx } = makeContext({ [sender]: {}, [target]: {} })
  ctx.args = ['22']
  await plugin('setage').execute(ctx)
  assert.equal(ctx.db.data.users[sender].age, 22)
  ctx.m.mentionedJid = [target]
  await plugin('marry').execute(ctx)
  assert.equal(ctx.db.data.users[sender].spouse, target)
  assert.equal(ctx.db.data.users[target].spouse, sender)
  await plugin('divorce').execute(ctx)
  assert.equal(ctx.db.data.users[sender].spouse, undefined)
  assert.equal(ctx.db.data.users[target].spouse, undefined)
})

test('touchMessage respeta el nombre personalizado del perfil', () => {
  const db = new Database()
  db.scheduleSave = () => {}
  db.data.users[sender] = { name: 'Lyann', customName: true, messages: 0, commands: 0 }
  db.touchMessage({
    sender,
    senderDisplay: sender,
    name: 'Nombre de WhatsApp',
    chat: 'chat@g.us',
  })
  assert.equal(db.data.users[sender].name, 'Lyann')
})
