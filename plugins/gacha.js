import {
  addCharacter,
  beginCharacterRoll,
  clearCharacterOffer,
  collectionUnits,
  endCharacterRoll,
  getCharacterOffer,
  pickCharacter,
  setCharacterOffer,
} from '../src/utils/characters.js'
import {
  ensureEconomyUser,
  formatCoins,
  nowFrom,
  randomFrom,
  spendCoins,
  totalCoinsOf,
} from '../src/utils/economy.js'

function caption(character, note = '') {
  return [
    '🎴 *PERSONAJE EN OFERTA*',
    '',
    `> ・ Nombre: *${character.name}*`,
    `> ・ Anime: *${character.anime}*`,
    `> ・ Rareza: *${character.rarityLabel}*`,
    `> ・ Precio: *${formatCoins(character.price)} coins*`,
    `> ・ HP: *${character.maxHp || '?'}*`,
    `> ・ Poder: *${character.power || '?'}*`,
    `> ・ ID: \`${character.id}\``,
    note,
  ].filter(Boolean).join('\n')
}

async function sendCharacter(ctx, character, text) {
  return ctx.send({ image: { url: character.image }, caption: text })
}

export default [
  {
    commands: ['w', 'rw', 'personaje', 'rollchar'],
    category: 'gacha',
    description: 'Tira un personaje aleatorio para reclamarlo.',
    async execute(ctx) {
      const started = beginCharacterRoll(ctx.userKey, nowFrom(ctx))
      if (!started.ok) {
        return ctx.reply(`☾ Espera *${Math.ceil(started.left / 1000)}s* para tirar otro personaje.`)
      }
      try {
        await ctx.react('🎴')
        const character = pickCharacter(() => randomFrom(ctx))
        const offer = setCharacterOffer(ctx.m.chat, character, ctx.userKey, nowFrom(ctx))
        const seconds = Math.max(1, Math.ceil((offer.expiresAt - nowFrom(ctx)) / 1000))
        await sendCharacter(ctx, character, caption(character,
          `> ・ Tiempo: *${seconds}s*\n\nUsa *${ctx.usedPrefix}claim* para comprarlo.`))
      } finally {
        endCharacterRoll(ctx.userKey)
      }
    },
  },
  {
    commands: ['claim', 'c', 'comprar', 'reclamar'],
    category: 'gacha',
    description: 'Compra el personaje que está en oferta.',
    async execute(ctx) {
      const offer = getCharacterOffer(ctx.m.chat, nowFrom(ctx))
      if (!offer) return ctx.reply(`☾ No hay un personaje en oferta. Tira uno con *${ctx.usedPrefix}w*.`)
      const character = offer.character
      const user = ensureEconomyUser(ctx)
      if (totalCoinsOf(user) < character.price) {
        return ctx.reply(`☾ Te faltan monedas.\n> Precio: *${formatCoins(character.price)} coins*\n> Tu saldo: *${formatCoins(totalCoinsOf(user))} coins*`)
      }
      if (!spendCoins(user, character.price)) return ctx.reply('☾ No se pudo cobrar el personaje.')
      const owned = addCharacter(user, character)
      clearCharacterOffer(ctx.m.chat)
      ctx.db.scheduleSave()
      await sendCharacter(ctx, character,
        `✅ *¡Personaje comprado!*\n\n> ・ ${character.name}\n` +
        `> ・ ${character.rarityLabel}\n> ・ Pagaste: *${formatCoins(character.price)} coins*\n` +
        `> ・ Ahora tienes: *x${owned.qty}*\n> ・ Harem: *${collectionUnits(user)}* unidades`)
    },
  },
]
