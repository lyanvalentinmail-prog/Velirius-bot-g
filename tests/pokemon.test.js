import test from 'node:test'
import assert from 'node:assert/strict'
import pokemonPlugins from '../plugins/pokemon.js'

const catchPlugin = pokemonPlugins.find(plugin => plugin.commands[0] === 'catch')
const pokedexPlugin = pokemonPlugins.find(plugin => plugin.commands[0] === 'pokedex')
const battlePlugin = pokemonPlugins.find(plugin => plugin.commands[0] === 'pokemonbattle')
const sender = '59811111111@s.whatsapp.net'
const target = '59822222222@s.whatsapp.net'
const pikachu = {
  id: 25,
  name: 'pikachu',
  types: ['electric'],
  height_m: 0.4,
  weight_kg: 6,
  stats: { hp: 35, attack: 55, defense: 40, 'special-attack': 50, 'special-defense': 50, speed: 90 },
  description: 'Pokémon Ratón',
  image: 'https://example.com/pikachu.png',
}

function makeContext({ text = '', args = [], users = {}, randomValues = [] } = {}) {
  const replies = []
  const sent = []
  const apiCalls = []
  let saves = 0
  const ctx = {
    text,
    args,
    usedPrefix: '.',
    userKey: sender,
    random: () => randomValues.length ? randomValues.shift() : 0.5,
    m: { sender, senderDisplay: sender, mentionedJid: [], quoted: null },
    db: {
      data: { users },
      scheduleSave: () => { saves += 1 },
    },
    api: {
      json: async (route, params) => {
        apiCalls.push({ route, params })
        return structuredClone(pikachu)
      },
    },
    react: async () => {},
    send: async payload => sent.push(payload),
    reply: async (message, extra = {}) => replies.push({ message, extra }),
  }
  return { ctx, replies, sent, apiCalls, saves: () => saves }
}

test('catch guarda capturas y acumula duplicados en la Pokédex', async () => {
  const { ctx, sent, apiCalls, saves } = makeContext({ randomValues: [0.1, 0.5] })
  await catchPlugin.execute(ctx)
  const collection = ctx.db.data.users[sender].pokemon
  assert.equal(collection.length, 1)
  assert.equal(collection[0].name, 'pikachu')
  assert.equal(collection[0].count, 1)
  assert.equal(collection[0].shiny, false)
  assert.equal(saves(), 1)
  assert.match(sent[0].caption, /atrapó a \*PIKACHU\*/)
  assert.deepEqual(apiCalls[0], {
    route: '/anime/pokemon',
    params: { query: 'random', shiny: false },
  })

  await catchPlugin.execute(ctx)
  assert.equal(collection.length, 1)
  assert.equal(collection[0].count, 2)
  assert.equal(saves(), 2)
})

test('pokedex muestra la colección y consulta nombre, ID o shiny', async () => {
  const users = {
    [sender]: { pokemon: [{ ...pikachu, count: 2, shiny: false }] },
  }
  const { ctx, replies, sent, apiCalls } = makeContext({ users })
  await pokedexPlugin.execute(ctx)
  assert.match(replies[0].message, /Atrapados: 2 · Especies: 1/)
  assert.match(replies[0].message, /PIKACHU #25 ×2/)
  assert.equal(apiCalls.length, 0)

  ctx.text = 'pikachu shiny'
  ctx.args = ['pikachu', 'shiny']
  await pokedexPlugin.execute(ctx)
  assert.deepEqual(apiCalls[0].params, { query: 'pikachu', shiny: true })
  assert.match(sent[0].caption, /PIKACHU.*✨/s)
  assert.match(sent[0].caption, /Poder total: 320/)
  assert.equal(sent[0].image.url, pikachu.image)
})

test('pokemonbattle enfrenta las colecciones y menciona al ganador', async () => {
  const users = {
    [sender]: { pokemon: [{ ...pikachu, count: 1 }] },
    [target]: {
      pokemon: [{
        id: 129,
        name: 'magikarp',
        stats: { hp: 20, attack: 10, defense: 55, 'special-attack': 15, 'special-defense': 20, speed: 80 },
        count: 1,
      }],
    },
  }
  const { ctx, replies } = makeContext({ users })
  ctx.m.mentionedJid = [target]
  await battlePlugin.execute(ctx)
  assert.match(replies[0].message, /COMBATE POKÉMON/)
  assert.match(replies[0].message, /PIKACHU/)
  assert.match(replies[0].message, /MAGIKARP/)
  assert.match(replies[0].message, /Ganador: @59811111111/)
  assert.deepEqual(replies[0].extra.contextInfo.mentionedJid, [sender, target])
})

test('pokemonbattle valida oponente y colecciones', async () => {
  const { ctx, replies } = makeContext()
  await battlePlugin.execute(ctx)
  assert.match(replies.at(-1).message, /Menciona o responde/)

  ctx.m.mentionedJid = [target]
  await battlePlugin.execute(ctx)
  assert.match(replies.at(-1).message, /Primero atrapa un Pokémon/)

  ctx.db.data.users[sender] = { pokemon: [{ ...pikachu }] }
  await battlePlugin.execute(ctx)
  assert.match(replies.at(-1).message, /todavía no tiene Pokémon atrapados/)
})
