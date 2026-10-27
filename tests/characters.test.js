import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import gachaPlugins from '../plugins/gacha.js'
import characterPlugins from '../plugins/characters.js'
import {
  addCharacter,
  characterCatalog,
  getCharacterOffer,
  resetCharacterSessions,
} from '../src/utils/characters.js'

const sender = '59811111111@s.whatsapp.net'
const target = '59822222222@s.whatsapp.net'
const gacha = name => gachaPlugins.find(item => item.commands[0] === name)
const character = name => characterPlugins.find(item => item.commands[0] === name)

function makeContext(users = {}) {
  const replies = []
  const sent = []
  let saves = 0
  let clock = 1_000_000
  const ctx = {
    userKey: sender,
    usedPrefix: '.',
    args: [],
    text: '',
    random: () => 0,
    now: () => clock,
    m: { chat: 'chat@g.us', sender, senderDisplay: sender, mentionedJid: [], quoted: null },
    db: {
      data: { users, charShop: { nextOrder: 1, listings: [] } },
      scheduleSave: () => { saves += 1 },
    },
    react: async () => {},
    send: async payload => sent.push(payload),
    reply: async (message, extra = {}) => replies.push({ message, extra }),
  }
  return {
    ctx,
    replies,
    sent,
    saves: () => saves,
    setNow: value => { clock = value },
  }
}

afterEach(() => resetCharacterSessions())

test('el catálogo local contiene personajes utilizables', () => {
  assert.equal(characterCatalog.length, 149)
  assert.equal(characterCatalog.some(character =>
    character.id === '21265' || /maple colors/i.test(character.anime)), false)
  for (const character of characterCatalog) {
    assert.ok(character.id)
    assert.ok(character.name)
    assert.ok(character.image)
    assert.ok(character.price > 0)
  }
})

test('w crea una oferta y claim cobra, guarda y acumula personajes', async () => {
  const { ctx, sent, replies, setNow, saves } = makeContext({ [sender]: { coins: 1_000_000 } })
  const user = ctx.db.data.users[sender]
  const selected = characterCatalog[0]
  await gacha('w').execute(ctx)
  assert.equal(sent.length, 1)
  assert.match(sent[0].caption, /PERSONAJE EN OFERTA/)
  assert.equal(getCharacterOffer(ctx.m.chat, 1_000_000).character.id, selected.id)

  await gacha('w').execute(ctx)
  assert.match(replies.at(-1).message, /Espera/)
  await gacha('claim').execute(ctx)
  assert.equal(user.characters.length, 1)
  assert.equal(user.characters[0].qty, 1)
  assert.equal(user.coins, 1_000_000 - selected.price)
  assert.equal(getCharacterOffer(ctx.m.chat, 1_000_000), null)

  setNow(1_036_000)
  await gacha('w').execute(ctx)
  await gacha('claim').execute(ctx)
  assert.equal(user.characters.length, 1)
  assert.equal(user.characters[0].qty, 2)
  assert.equal(user.coins, 1_000_000 - selected.price * 2)
  assert.equal(saves(), 2)
})

test('darhr transfiere una unidad a otro usuario', async () => {
  const users = { [sender]: {}, [target]: {} }
  addCharacter(users[sender], characterCatalog[0])
  const { ctx, replies } = makeContext(users)
  ctx.m.mentionedJid = [target]
  ctx.args = ['@59822222222', '1']
  await character('darhr').execute(ctx)
  assert.equal(users[sender].characters.length, 0)
  assert.equal(users[target].characters.length, 1)
  assert.equal(users[target].characters[0].id, characterCatalog[0].id)
  assert.match(replies[0].message, /regaló/)
})

test('harem pagina sin cambiar los números globales de vharem', async () => {
  const users = { [sender]: {} }
  for (const item of characterCatalog.slice(0, 35)) addCharacter(users[sender], item)
  const { ctx, replies, sent } = makeContext(users)
  ctx.args = ['2']
  await character('harem').execute(ctx)
  assert.match(replies[0].message, /Página: 2\/2/)
  assert.match(replies[0].message, /> 31\. /)

  ctx.text = '31'
  await character('vharem').execute(ctx)
  assert.ok(sent[0].caption.includes(characterCatalog[30].name))
})

test('tienda compra, paga al vendedor y cancela sin duplicar personajes', async () => {
  const users = { [sender]: { coins: 0 }, [target]: { coins: 100000 } }
  addCharacter(users[sender], characterCatalog[0])
  const { ctx, replies } = makeContext(users)
  ctx.args = ['1', '5000']
  await character('vender').execute(ctx)
  assert.equal(users[sender].characters.length, 0)
  assert.equal(ctx.db.data.charShop.listings[0].status, 'active')

  await character('tiendag').execute(ctx)
  assert.match(replies.at(-1).message, /1\. \*.*\* · 5000 coins/)

  ctx.userKey = target
  ctx.m.sender = target
  ctx.m.senderDisplay = target
  ctx.args = ['1']
  await character('comprarg').execute(ctx)
  assert.equal(users[target].coins, 95000)
  assert.equal(users[sender].coins, 5000)
  assert.equal(users[target].characters.length, 1)
  assert.equal(ctx.db.data.charShop.listings[0].status, 'sold')

  addCharacter(users[sender], characterCatalog[1])
  ctx.userKey = sender
  ctx.m.sender = sender
  ctx.m.senderDisplay = sender
  ctx.args = ['1', '6000']
  await character('vender').execute(ctx)
  const secondOrder = ctx.db.data.charShop.nextOrder - 1
  ctx.args = [String(secondOrder)]
  await character('comprarg').execute(ctx)
  assert.match(replies.at(-1).message, /No puedes comprar tu propia publicación/)

  await character('cancelarg').execute(ctx)
  assert.equal(users[sender].characters.length, 1)
  assert.equal(users[sender].characters[0].id, characterCatalog[1].id)
  assert.equal(ctx.db.data.charShop.listings.find(item => item.order === secondOrder).status, 'cancelled')
})
