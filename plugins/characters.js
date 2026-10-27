import {
  activeListings,
  addCharacter,
  characterShop,
  collectionOf,
  collectionUnits,
  collectionValue,
  findCharacterIndex,
  pruneCharacterShop,
  takeCharacter,
} from '../src/utils/characters.js'
import {
  addCoins,
  economyUserKey,
  ensureEconomyUser,
  formatCoins,
  nowFrom,
  parseCoins,
  spendCoins,
  totalCoinsOf,
} from '../src/utils/economy.js'
import { cleanNumber, truncate } from '../src/utils/format.js'
import { requestedTargets } from '../src/utils/group.js'
import { sameUser } from '../src/utils/jid.js'

function characterFromListing(listing) {
  return {
    id: listing.charId,
    name: listing.name,
    anime: listing.anime,
    image: listing.image,
    imageAlt: listing.imageAlt,
    rarity: listing.rarity,
    rarityLabel: listing.rarityLabel,
    price: listing.catalogPrice,
    maxHp: listing.maxHp,
    power: listing.power,
  }
}

function listingOf(ctx, order) {
  return characterShop(ctx).listings.find(listing => listing.order === Number(order)) || null
}

async function sendCharacter(ctx, character, caption) {
  if (character.image) return ctx.send({ image: { url: character.image }, caption })
  return ctx.reply(caption)
}

export default [
  {
    commands: ['harem', 'personajes', 'mischars', 'coleccion', 'chars'],
    category: 'personajes',
    description: 'Muestra tu colección de personajes por páginas.',
    usage: '[página]',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      const collection = collectionOf(user)
      if (!collection.length) return ctx.reply(`🎴 Tu harem está vacío. Tira con *${ctx.usedPrefix}w* y compra con *${ctx.usedPrefix}claim*.`)
      const pageSize = 30
      const pages = Math.ceil(collection.length / pageSize)
      const page = ctx.args.length ? Number(ctx.args[0]) : 1
      if (!Number.isInteger(page) || page < 1 || page > pages) {
        return ctx.reply(`☾ Página inválida. Tu harem tiene *${pages}* ${pages === 1 ? 'página' : 'páginas'}.`)
      }
      const offset = (page - 1) * pageSize
      const lines = collection.slice(offset, offset + pageSize).map((character, index) =>
        `> ${offset + index + 1}. *${character.name}* · ${character.rarityLabel} · x${character.qty || 1}`)
      await ctx.reply(truncate(
        `🎴 *TU HAREM*\n> Tipos: ${collection.length} · Unidades: ${collectionUnits(user)}\n` +
        `> Valor: ${formatCoins(collectionValue(user))} coins · Página: ${page}/${pages}\n\n${lines.join('\n')}\n\n` +
        `Usa *${ctx.usedPrefix}vharem <n°>* para ver un personaje.`,
        5500,
      ))
    },
  },
  {
    commands: ['vharem', 'verharem', 'charinfo', 'vh'],
    category: 'personajes',
    description: 'Muestra los detalles de un personaje de tu harén.',
    usage: '<n° o nombre>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      const index = findCharacterIndex(user, ctx.text)
      if (index < 0) return ctx.reply(`☾ Usa *${ctx.usedPrefix}vharem <n° o nombre>* según tu harem.`)
      const character = collectionOf(user)[index]
      await sendCharacter(ctx, character,
        `🎴 *${character.name}*\n> Anime: ${character.anime}\n` +
        `> Rareza: ${character.rarityLabel}\n> Precio base: ${formatCoins(character.price)} coins\n` +
        `> HP: ${character.maxHp || '?'} · Poder: ${character.power || '?'}\n` +
        `> Cantidad: x${character.qty || 1}\n> ID: \`${character.id}\``)
    },
  },
  {
    commands: ['darhr', 'darharem', 'regalarhr', 'givehr'],
    category: 'personajes',
    description: 'Regala una unidad de tu harén a otro usuario.',
    usage: '<@usuario> <n°>',
    async execute(ctx) {
      const target = requestedTargets(ctx, { text: false })[0]
      if (!target) return ctx.reply(`☾ Usa *${ctx.usedPrefix}darhr @usuario <n°>*.`)
      if (sameUser(ctx.userKey, target) || sameUser(ctx.m.sender, target)) return ctx.reply('☾ No puedes regalarte un personaje a ti mismo.')
      const sender = ensureEconomyUser(ctx)
      const index = findCharacterIndex(sender, ctx.args.at(-1))
      if (index < 0) return ctx.reply('☾ No se encontró ese personaje en tu harem.')
      const targetKey = economyUserKey(ctx.db.data.users, target)
      const receiver = ensureEconomyUser(ctx, targetKey)
      const character = takeCharacter(sender, index)
      addCharacter(receiver, character)
      ctx.db.scheduleSave()
      await ctx.reply(`🎁 @${cleanNumber(ctx.m.senderDisplay)} regaló *${character.name}* a @${cleanNumber(target)}.`, {
        contextInfo: { mentionedJid: [ctx.m.sender, target] },
      })
    },
  },
  {
    commands: ['vender', 'sellchar', 'venderchar', 'cvender'],
    category: 'personajes',
    description: 'Publica una unidad de tu harén en la tienda.',
    usage: '<n°> <precio>',
    async execute(ctx) {
      const seller = ensureEconomyUser(ctx)
      const index = findCharacterIndex(seller, ctx.args[0])
      const price = parseCoins(ctx.args[1])
      if (index < 0 || price < 100) return ctx.reply(`☾ Usa *${ctx.usedPrefix}vender <n°> <precio>*; el precio mínimo es 100 coins.`)
      const character = takeCharacter(seller, index)
      const shop = characterShop(ctx)
      const order = shop.nextOrder++
      shop.listings.push({
        order,
        status: 'active',
        sellerJid: ctx.userKey,
        sellerName: seller.name || ctx.m.name || 'Usuario',
        charId: character.id,
        name: character.name,
        anime: character.anime,
        image: character.image,
        imageAlt: character.imageAlt,
        rarity: character.rarity,
        rarityLabel: character.rarityLabel,
        catalogPrice: character.price,
        maxHp: character.maxHp,
        power: character.power,
        price,
        createdAt: nowFrom(ctx),
        closedAt: null,
      })
      ctx.db.scheduleSave()
      await ctx.reply(`🛒 *${character.name}* publicado.\n> Orden: *${order}*\n> Precio: *${formatCoins(price)} coins*`)
    },
  },
  {
    commands: ['cancelarg', 'cancelarvender', 'cancelg', 'cancelartienda'],
    category: 'personajes',
    description: 'Cancela una publicación y recupera el personaje.',
    usage: '<orden>',
    async execute(ctx) {
      const listing = listingOf(ctx, ctx.args[0])
      if (!listing || listing.status !== 'active') return ctx.reply('☾ No hay una publicación activa con ese orden.')
      if (!sameUser(listing.sellerJid, ctx.userKey) && !sameUser(listing.sellerJid, ctx.m.sender)) {
        return ctx.reply('☾ Sólo el vendedor puede cancelar esta publicación.')
      }
      const seller = ensureEconomyUser(ctx)
      listing.status = 'cancelled'
      listing.closedAt = nowFrom(ctx)
      addCharacter(seller, characterFromListing(listing))
      pruneCharacterShop(ctx)
      ctx.db.scheduleSave()
      await ctx.reply(`☾ Publicación *${listing.order}* cancelada; *${listing.name}* volvió a tu harem.`)
    },
  },
  {
    commands: ['tiendag', 'tiendagacha', 'gshop', 'charshop'],
    category: 'personajes',
    description: 'Muestra los personajes publicados por los usuarios.',
    async execute(ctx) {
      const listings = activeListings(ctx)
      if (!listings.length) return ctx.reply('🛒 La tienda de personajes está vacía.')
      const lines = listings.slice(0, 25).map(listing =>
        `> ${listing.order}. *${listing.name}* · ${formatCoins(listing.price)} coins · ${listing.sellerName}`)
      await ctx.reply(truncate(
        `🛒 *TIENDA GACHA*\n${lines.join('\n')}\n\nUsa *${ctx.usedPrefix}comprarg <orden>*.`,
        5000,
      ))
    },
  },
  {
    commands: ['comprarg', 'buyg', 'comprargacha'],
    category: 'personajes',
    description: 'Compra una publicación de la tienda gacha.',
    usage: '<orden>',
    async execute(ctx) {
      const listing = listingOf(ctx, ctx.args[0])
      if (!listing || listing.status !== 'active') return ctx.reply('☾ No hay una publicación activa con ese orden.')
      if (sameUser(listing.sellerJid, ctx.userKey) || sameUser(listing.sellerJid, ctx.m.sender)) {
        return ctx.reply('☾ No puedes comprar tu propia publicación.')
      }
      const buyer = ensureEconomyUser(ctx)
      if (totalCoinsOf(buyer) < listing.price) {
        return ctx.reply(`☾ Necesitas *${formatCoins(listing.price)} coins*; tienes *${formatCoins(totalCoinsOf(buyer))}*.`)
      }
      const sellerKey = economyUserKey(ctx.db.data.users, listing.sellerJid)
      const seller = ensureEconomyUser(ctx, sellerKey)
      if (!spendCoins(buyer, listing.price)) return ctx.reply('☾ No se pudo completar el pago.')
      addCharacter(buyer, characterFromListing(listing))
      addCoins(seller, listing.price)
      listing.status = 'sold'
      listing.buyerJid = ctx.userKey
      listing.closedAt = nowFrom(ctx)
      pruneCharacterShop(ctx)
      ctx.db.scheduleSave()
      await ctx.reply(`✅ Compraste *${listing.name}* por *${formatCoins(listing.price)} coins*.\n> Orden: ${listing.order}`)
    },
  },
  {
    commands: ['topharem', 'topharems', 'topchars', 'topgacha', 'gacha'],
    category: 'personajes',
    description: 'Muestra los haréns con mayor valor de colección.',
    usage: '[cantidad]',
    async execute(ctx) {
      const limit = Math.min(25, Math.max(1, Number(ctx.args[0]) || 10))
      const ranking = Object.entries(ctx.db.data.users).filter(([, user]) => collectionOf(user).length)
        .map(([jid, user]) => ({
          jid,
          name: user.name || 'Usuario',
          units: collectionUnits(user),
          value: collectionValue(user),
        }))
        .sort((a, b) => b.value - a.value).slice(0, limit)
      if (!ranking.length) return ctx.reply('☾ Todavía no hay haréns para clasificar.')
      await ctx.reply(truncate(
        `🏆 *TOP HAREM*\n${ranking.map((user, index) =>
          `> ${index + 1}. *${user.name}* · ${user.units} uds · ${formatCoins(user.value)} coins`).join('\n')}`,
        5000,
      ))
    },
  },
]
