import {
  addCoins,
  bankOf,
  economyUserKey,
  ensureEconomyUser,
  formatCoins,
  nowFrom,
  parseCoins,
  randomFrom,
  remainingTime,
  totalCoinsOf,
  walletOf,
} from '../src/utils/economy.js'
import { cleanNumber, truncate } from '../src/utils/format.js'
import { requestedTargets } from '../src/utils/group.js'
import { sameUser } from '../src/utils/jid.js'

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000
const WORK_COOLDOWN = 5 * 60 * 1000
const BANKS = {
  konoha: 'BANK KONOHA',
  akatsuki: 'BANK AKATSUKI',
  boys: 'BANK BOYS',
}
const JOBS = [
  ['Ayudaste a una abuelita a cruzar la calle', 600, 1200, false],
  ['Trabajaste como mesero en un restaurante', 700, 1400, false],
  ['Reparaste la computadora de un vecino', 900, 1800, false],
  ['Diste clases particulares de matemáticas', 1000, 2000, false],
  ['Vendiste artesanías en el mercado', 750, 1500, false],
  ['Trabajaste como voluntario en un refugio', 850, 1700, false],
  ['Repartiste pedidos en bicicleta', 650, 1300, false],
  ['Tuviste que pagar una multa por estacionar mal', 500, 1000, true],
  ['Se dañó tu herramienta de trabajo y pagaste la reparación', 600, 1200, true],
  ['Perdiste dinero en el transporte de vuelta a casa', 350, 800, true],
]

async function bankRequired(ctx, user) {
  if (user.banco) return false
  await ctx.reply(`☾ No perteneces a un banco. Usa *${ctx.usedPrefix}unirsebank <konoha/akatsuki/boys>*.`)
  return true
}

function amountFrom(ctx, available) {
  const raw = String(ctx.args[0] || '').toLowerCase()
  return ['all', 'todo'].includes(raw) ? available : parseCoins(raw)
}

export default [
  {
    commands: ['balance', 'bal', 'coins'],
    category: 'economia',
    description: 'Muestra tu saldo o el de otro usuario.',
    usage: '[@usuario]',
    async execute(ctx) {
      const target = requestedTargets(ctx, { text: false })[0]
      const key = target ? economyUserKey(ctx.db.data.users, target) : ctx.userKey
      const user = ensureEconomyUser(ctx, key)
      const jid = target || ctx.m.sender
      await ctx.reply(
        `☾ *ECONOMÍA DE @${cleanNumber(jid)}*\n` +
        `> Cartera: *${formatCoins(walletOf(user))} coins*\n` +
        `> Banco: *${formatCoins(bankOf(user))} coins*\n` +
        `> Total: *${formatCoins(totalCoinsOf(user))} coins*`,
        { contextInfo: { mentionedJid: [jid] } },
      )
    },
  },
  {
    commands: ['daily', 'day', 'diario'],
    category: 'economia',
    description: 'Reclama coins diarios con una racha creciente.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      const now = nowFrom(ctx)
      const last = Number(user.lastDaily) || 0
      const remaining = DAILY_COOLDOWN - (now - last)
      if (last && remaining > 0) return ctx.reply(`☾ Ya reclamaste tu daily. Vuelve en *${remainingTime(remaining)}*.`)
      const streak = !last || now - last > DAILY_COOLDOWN + 60000 ? 1 : (Number(user.dailyStreak) || 0) + 1
      const reward = 9000 + (streak - 1) * 500
      addCoins(user, reward)
      user.dailyStreak = streak
      user.lastDaily = now
      ctx.db.scheduleSave()
      await ctx.reply(
        `🎁 *DAILY*\n> Racha: *${streak}* 🔥\n> Premio: *+${formatCoins(reward)} coins*\n` +
        `> Total en cartera: *${formatCoins(walletOf(user))} coins*\n` +
        `> Próxima recompensa: *${formatCoins(reward + 500)} coins*`,
      )
    },
  },
  {
    commands: ['work', 'trabajar', 'trabajo'],
    category: 'economia',
    description: 'Trabaja cada cinco minutos para ganar o perder coins.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      const now = nowFrom(ctx)
      const remaining = (Number(user.lastWork) || 0) + WORK_COOLDOWN - now
      if (remaining > 0) return ctx.reply(`☾ Debes esperar *${remainingTime(remaining)}* para volver a trabajar.`)
      const job = JOBS[Math.floor(randomFrom(ctx) * JOBS.length)] || JOBS[0]
      const [description, min, max, loss] = job
      const amount = min + Math.floor(randomFrom(ctx) * (max - min + 1))
      const delta = loss ? -Math.min(walletOf(user), amount) : amount
      user.coins = walletOf(user) + delta
      user.lastWork = now
      ctx.db.scheduleSave()
      await ctx.reply(
        `💼 *TRABAJO*\n> ${description}\n> Resultado: *${delta >= 0 ? '+' : '-'}${formatCoins(Math.abs(delta))} coins*\n` +
        `> Cartera: *${formatCoins(walletOf(user))} coins*`,
      )
    },
  },
  {
    commands: ['transf', 'transfer', 'donar', 'dar'],
    category: 'economia',
    description: 'Transfiere coins de tu cartera a otro usuario.',
    usage: '<@usuario> <cantidad>',
    async execute(ctx) {
      const target = requestedTargets(ctx, { text: false })[0]
      const amount = parseCoins(ctx.args.at(-1))
      if (!target || !amount) return ctx.reply(`☾ Usa *${ctx.usedPrefix}transf @usuario <cantidad>*.`)
      if (sameUser(ctx.userKey, target) || sameUser(ctx.m.sender, target)) return ctx.reply('☾ No puedes transferirte coins a ti mismo.')
      const sender = ensureEconomyUser(ctx)
      if (walletOf(sender) < amount) return ctx.reply(`☾ No tienes suficientes coins en tu cartera; tienes *${formatCoins(walletOf(sender))}*.`)
      const targetKey = economyUserKey(ctx.db.data.users, target)
      const receiver = ensureEconomyUser(ctx, targetKey)
      sender.coins = walletOf(sender) - amount
      addCoins(receiver, amount)
      ctx.db.scheduleSave()
      await ctx.reply(`💸 @${cleanNumber(ctx.m.senderDisplay)} transfirió *${formatCoins(amount)} coins* a @${cleanNumber(target)}.`, {
        contextInfo: { mentionedJid: [ctx.m.sender, target] },
      })
    },
  },
  {
    commands: ['banco', 'bank'],
    category: 'economia',
    description: 'Muestra tu cuenta y saldo bancario.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (await bankRequired(ctx, user)) return
      await ctx.reply(
        `🌴 *${BANKS[user.banco]}*\n> Cartera: *${formatCoins(walletOf(user))} coins*\n` +
        `> En banco: *${formatCoins(bankOf(user))} coins*\n> Total: *${formatCoins(totalCoinsOf(user))} coins*`,
      )
    },
  },
  {
    commands: ['unirsebank'],
    category: 'economia',
    description: 'Te une a un banco.',
    usage: '<konoha/akatsuki/boys>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      const bank = String(ctx.args[0] || '').toLowerCase()
      if (user.banco) return ctx.reply(`☾ Ya perteneces a *${BANKS[user.banco]}*; usa *${ctx.usedPrefix}change <banco>*.`)
      if (!BANKS[bank]) return ctx.reply('☾ Banco inválido. Elige: *konoha*, *akatsuki* o *boys*.')
      user.banco = bank
      ctx.db.scheduleSave()
      await ctx.reply(`🌴 Te uniste a *${BANKS[bank]}* correctamente.`)
    },
  },
  {
    commands: ['change'],
    category: 'economia',
    description: 'Cambia de banco por 350 coins.',
    usage: '<konoha/akatsuki/boys>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (await bankRequired(ctx, user)) return
      const bank = String(ctx.args[0] || '').toLowerCase()
      if (!BANKS[bank]) return ctx.reply('☾ Banco inválido. Elige: *konoha*, *akatsuki* o *boys*.')
      if (bank === user.banco) return ctx.reply(`☾ Ya perteneces a *${BANKS[bank]}*.`)
      if (walletOf(user) < 350) return ctx.reply('☾ Cambiar de banco cuesta *350 coins* en cartera.')
      user.coins = walletOf(user) - 350
      user.banco = bank
      ctx.db.scheduleSave()
      await ctx.reply(`🌴 Cambiaste a *${BANKS[bank]}* por *350 coins*.`)
    },
  },
  {
    commands: ['deposit'],
    category: 'economia',
    description: 'Deposita coins de tu cartera en el banco.',
    usage: '<cantidad/all>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (await bankRequired(ctx, user)) return
      const amount = amountFrom(ctx, walletOf(user))
      if (!amount) return ctx.reply(`☾ Usa *${ctx.usedPrefix}deposit <cantidad/all>*.`)
      if (walletOf(user) < amount) return ctx.reply('☾ No tienes suficientes coins en tu cartera.')
      user.coins = walletOf(user) - amount
      user.bancoDinero = bankOf(user) + amount
      ctx.db.scheduleSave()
      await ctx.reply(`🌴 Depositaste *${formatCoins(amount)} coins*.\n> En banco: *${formatCoins(bankOf(user))}*`)
    },
  },
  {
    commands: ['withdraw'],
    category: 'economia',
    description: 'Retira coins del banco a tu cartera.',
    usage: '<cantidad/all>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (await bankRequired(ctx, user)) return
      const amount = amountFrom(ctx, bankOf(user))
      if (!amount) return ctx.reply(`☾ Usa *${ctx.usedPrefix}withdraw <cantidad/all>*.`)
      if (bankOf(user) < amount) return ctx.reply('☾ No tienes suficientes coins en el banco.')
      user.bancoDinero = bankOf(user) - amount
      user.coins = walletOf(user) + amount
      ctx.db.scheduleSave()
      await ctx.reply(`🌴 Retiraste *${formatCoins(amount)} coins*.\n> Cartera: *${formatCoins(walletOf(user))}*`)
    },
  },
  {
    commands: ['topcoins', 'topcoin', 'top-coins', 'richest', 'ricos'],
    category: 'economia',
    description: 'Muestra los diez usuarios con más coins.',
    async execute(ctx) {
      const ranking = Object.entries(ctx.db.data.users).map(([jid, user]) => ({
        jid,
        name: user.name || 'Usuario',
        total: totalCoinsOf(user),
      })).filter(user => user.total > 0).sort((a, b) => b.total - a.total).slice(0, 10)
      if (!ranking.length) return ctx.reply('☾ Todavía no hay usuarios con coins.')
      await ctx.reply(truncate(
        `💰 *TOP COINS*\n${ranking.map((user, index) =>
          `> ${index + 1}. *${user.name}* · ${formatCoins(user.total)} coins`).join('\n')}`,
        4000,
      ))
    },
  },
]
