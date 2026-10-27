import { cleanNumber, truncate } from '../src/utils/format.js'
import { requestedTargets } from '../src/utils/group.js'
import { sameUser } from '../src/utils/jid.js'

const CATCH_RATE = 0.75
const SHINY_RATE = 0.08

function randomFrom(ctx) {
  return typeof ctx.random === 'function' ? ctx.random() : Math.random()
}

function collectionOf(user) {
  return Array.isArray(user?.pokemon) ? user.pokemon : []
}

function totalCaught(collection) {
  return collection.reduce((total, pokemon) => total + (Number(pokemon.count) || 1), 0)
}

function powerOf(pokemon) {
  return Object.values(pokemon?.stats || {}).reduce((total, value) => {
    const stat = Number(value)
    return total + (Number.isFinite(stat) ? stat : 0)
  }, 0)
}

function displayName(pokemon) {
  return String(pokemon?.name || 'Desconocido').toUpperCase()
}

function recordOf(data, shiny) {
  return {
    id: data.id || null,
    name: String(data.name || 'desconocido').toLowerCase(),
    shiny: Boolean(shiny),
    types: Array.isArray(data.types) ? data.types.slice(0, 4) : [],
    stats: { ...(data.stats || {}) },
    image: data.image || data.sprite || '',
    count: 1,
    caughtAt: new Date().toISOString(),
  }
}

function pokemonCaption(data) {
  const stats = Object.entries(data.stats || {})
    .map(([name, value]) => `${name}: ${value}`).join(' · ')
  return truncate(
    `☾ *${displayName(data)}* #${data.id || '?'}${data.shiny ? ' ✨' : ''}\n` +
    `> Tipos: ${(data.types || []).join(', ') || 'Desconocidos'}\n` +
    `> Altura: ${data.height_m ?? '?'} m · Peso: ${data.weight_kg ?? '?'} kg\n` +
    `> Poder total: ${powerOf(data)}\n> ${data.description || ''}\n\n${stats}`,
    3500,
  )
}

async function sendPokemon(ctx, data, caption, mentionedJid = []) {
  const contextInfo = mentionedJid.length ? { contextInfo: { mentionedJid } } : {}
  if (data.image || data.sprite) {
    return ctx.send({ image: { url: data.image || data.sprite }, caption, ...contextInfo })
  }
  return ctx.reply(caption, contextInfo)
}

function userKeyFor(users, target) {
  return Object.keys(users).find(key => sameUser(key, target)) || target
}

function pickPokemon(collection, random) {
  return collection[Math.floor(random() * collection.length)] || collection[0]
}

function battleScore(pokemon, random) {
  return Math.round(powerOf(pokemon) * (0.85 + random() * 0.3))
}

export default [
  {
    commands: ['catch'],
    category: 'pokemon',
    description: 'Atrapa un Pokémon aleatorio para tu colección.',
    async execute(ctx) {
      const success = randomFrom(ctx) < CATCH_RATE
      const shiny = randomFrom(ctx) < SHINY_RATE
      await ctx.react('⚡')
      const data = await ctx.api.json('/anime/pokemon', { query: 'random', shiny })
      const name = displayName(data)
      const sender = `@${cleanNumber(ctx.m.senderDisplay)}`
      if (!success) {
        return sendPokemon(ctx, data,
          `☾ ${sender}, ¡${name} se escapó! Inténtalo otra vez con ${ctx.usedPrefix}catch.`,
          [ctx.m.sender])
      }

      const users = ctx.db.data.users
      const user = users[ctx.userKey] ||= {}
      user.pokemon = collectionOf(user)
      const caught = recordOf({ ...data, shiny }, shiny)
      const existing = user.pokemon.find(pokemon =>
        pokemon.id === caught.id && pokemon.name === caught.name && Boolean(pokemon.shiny) === caught.shiny)
      if (existing) {
        existing.count = (Number(existing.count) || 1) + 1
        existing.caughtAt = caught.caughtAt
      } else user.pokemon.push(caught)
      ctx.db.scheduleSave()

      return sendPokemon(ctx, data,
        `☾ ¡${sender} atrapó a *${name}*${shiny ? ' ✨' : ''}!\n` +
        `> Tipos: ${(data.types || []).join(', ') || 'Desconocidos'}\n` +
        `> Poder total: ${powerOf(data)}\n` +
        `> Colección: ${totalCaught(user.pokemon)} Pokémon`,
        [ctx.m.sender])
    },
  },
  {
    commands: ['pokedex', 'pokemon'],
    category: 'pokemon',
    description: 'Consulta un Pokémon o muestra tu colección.',
    usage: '[nombre, ID o random]',
    async execute(ctx) {
      const args = ctx.args || ctx.text.split(/\s+/).filter(Boolean)
      if (!ctx.text) {
        const collection = collectionOf(ctx.db.data.users[ctx.userKey])
        if (!collection.length) return ctx.reply(`☾ Tu Pokédex está vacía. Atrapa uno con ${ctx.usedPrefix}catch.`)
        const list = collection.slice(0, 25).map(pokemon =>
          `> • ${displayName(pokemon)} #${pokemon.id || '?'}${pokemon.shiny ? ' ✨' : ''}${pokemon.count > 1 ? ` ×${pokemon.count}` : ''}`)
        const remaining = collection.length > 25 ? `\n> … y ${collection.length - 25} especies más.` : ''
        return ctx.reply(truncate(
          `☾ *POKÉDEX DE @${cleanNumber(ctx.m.senderDisplay)}*\n` +
          `> Atrapados: ${totalCaught(collection)} · Especies: ${collection.length}\n` +
          `${list.join('\n')}${remaining}\n\nUsa ${ctx.usedPrefix}pokedex nombre para consultar un Pokémon.`,
          5000,
        ), { contextInfo: { mentionedJid: [ctx.m.sender] } })
      }

      const shiny = args.some(arg => arg.toLowerCase() === 'shiny')
      const query = args.filter(arg => arg.toLowerCase() !== 'shiny').join(' ') || 'random'
      await ctx.react('⚡')
      const data = await ctx.api.json('/anime/pokemon', { query, shiny })
      return sendPokemon(ctx, { ...data, shiny }, pokemonCaption({ ...data, shiny }))
    },
  },
  {
    commands: ['pokemonbattle'],
    category: 'pokemon',
    description: 'Combate contra la colección de otro usuario.',
    usage: '[@usuario]',
    async execute(ctx) {
      const target = requestedTargets(ctx, { text: false })[0]
      if (!target) return ctx.reply(`☾ Menciona o responde a un usuario con ${ctx.usedPrefix}pokemonbattle.`)
      if (sameUser(ctx.userKey, target) || sameUser(ctx.m.sender, target)) {
        return ctx.reply('☾ No puedes combatir contra ti mismo.')
      }

      const users = ctx.db.data.users
      const ownCollection = collectionOf(users[ctx.userKey])
      const targetKey = userKeyFor(users, target)
      const targetCollection = collectionOf(users[targetKey])
      if (!ownCollection.length) return ctx.reply(`☾ Primero atrapa un Pokémon con ${ctx.usedPrefix}catch.`)
      if (!targetCollection.length) return ctx.reply(`☾ @${cleanNumber(target)} todavía no tiene Pokémon atrapados.`, {
        contextInfo: { mentionedJid: [target] },
      })

      await ctx.react('⚔️')
      const own = pickPokemon(ownCollection, () => randomFrom(ctx))
      const rival = pickPokemon(targetCollection, () => randomFrom(ctx))
      const ownScore = battleScore(own, () => randomFrom(ctx))
      const rivalScore = battleScore(rival, () => randomFrom(ctx))
      const sender = `@${cleanNumber(ctx.m.senderDisplay)}`
      const opponent = `@${cleanNumber(target)}`
      const result = ownScore === rivalScore
        ? '🤝 Empate'
        : `🏆 Ganador: ${ownScore > rivalScore ? sender : opponent}`
      await ctx.reply(
        `☾ *COMBATE POKÉMON*\n\n` +
        `${sender}: *${displayName(own)}* · Poder ${powerOf(own)} · Resultado ${ownScore}\n` +
        `${opponent}: *${displayName(rival)}* · Poder ${powerOf(rival)} · Resultado ${rivalScore}\n\n${result}`,
        { contextInfo: { mentionedJid: [ctx.m.sender, target] } },
      )
    },
  },
]
