import {
  addCoins,
  economyUserKey,
  ensureEconomyUser,
  formatCoins,
  nowFrom,
  parseCoins,
  randomFrom,
  remainingTime,
  spendCoins,
  totalCoinsOf,
  walletOf,
} from '../src/utils/economy.js'
import { cleanNumber, normalizeCommand } from '../src/utils/format.js'
import { requestedTargets } from '../src/utils/group.js'
import { sameUser } from '../src/utils/jid.js'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
const riddles = new Map()
const hangmanGames = new Map()
const RIDDLES = [
  ['Tengo ciudades sin casas, ríos sin agua y bosques sin árboles. ¿Qué soy?', 'mapa'],
  ['Cuanto más quitas, más grande se vuelve. ¿Qué es?', 'agujero'],
  ['Tiene cuello pero no cabeza. ¿Qué es?', 'botella'],
  ['Va con caballo, pero no es jinete; va con rey, pero no es corona.', 'jaque'],
  ['Tiene dientes y no come. ¿Qué es?', 'peine'],
  ['Si me nombras, me rompes. ¿Qué soy?', 'silencio'],
]
const WORDS = ['pikachu', 'velirius', 'whatsapp', 'programacion', 'anime', 'guitarra', 'computadora', 'aventura']

async function cooldown(ctx, user, key, milliseconds) {
  const now = nowFrom(ctx)
  user.gameCooldowns ||= {}
  const left = (Number(user.gameCooldowns[key]) || 0) + milliseconds - now
  if (left > 0) {
    await ctx.reply(`☾ Espera *${remainingTime(left)}* para volver a usar este comando.`)
    return false
  }
  user.gameCooldowns[key] = now
  return true
}

function changeWallet(user, delta) {
  if (delta >= 0) addCoins(user, delta)
  else user.coins = Math.max(0, walletOf(user) + delta)
  return delta
}

function rewardGame(command, description, events, { min = 100, max = 1500, cooldownMs = 5 * MINUTE, lossRate = 0.25 } = {}) {
  return {
    commands: [command],
    category: 'rpg',
    description,
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (!await cooldown(ctx, user, command, cooldownMs)) return
      const event = events[Math.floor(randomFrom(ctx) * events.length)] || events[0]
      const amount = min + Math.floor(randomFrom(ctx) * (max - min + 1))
      const lost = randomFrom(ctx) < lossRate
      const delta = changeWallet(user, lost ? -Math.min(walletOf(user), amount) : amount)
      ctx.db.scheduleSave()
      await ctx.reply(
        `🎲 *${command.toUpperCase()}*\n> ${event}\n> Resultado: *${delta >= 0 ? '+' : '-'}${formatCoins(Math.abs(delta))} coins*\n` +
        `> Cartera: *${formatCoins(walletOf(user))} coins*`,
      )
    },
  }
}

function hangmanView(game) {
  const word = [...game.word].map(letter => game.guessed.has(letter) ? letter.toUpperCase() : '＿').join(' ')
  const missing = [...new Set([...game.word].filter(letter => !game.guessed.has(letter)))]
  return { word, missing }
}

export function resetGames() {
  riddles.clear()
  hangmanGames.clear()
}

export default [
  {
    commands: ['dado'],
    category: 'rpg',
    description: 'Lanza un dado de seis caras.',
    async execute(ctx) {
      const result = 1 + Math.floor(randomFrom(ctx) * 6)
      await ctx.reply(`🎲 El dado cayó en *${result}*.`)
    },
  },
  {
    commands: ['adivinanza'],
    category: 'rpg',
    description: 'Inicia o responde una adivinanza.',
    usage: '[respuesta]',
    async execute(ctx) {
      let current = riddles.get(ctx.m.chat)
      if (!current) {
        const item = RIDDLES[Math.floor(randomFrom(ctx) * RIDDLES.length)] || RIDDLES[0]
        current = { question: item[0], answer: item[1], at: nowFrom(ctx) }
        riddles.set(ctx.m.chat, current)
        return ctx.reply(`🧩 *ADIVINANZA*\n> ${current.question}\n\nResponde con *${ctx.usedPrefix}adivinanza <respuesta>*.`)
      }
      if (!ctx.text) return ctx.reply(`🧩 ${current.question}`)
      if (normalizeCommand(ctx.text) !== current.answer) return ctx.reply('☾ Respuesta incorrecta; inténtalo otra vez.')
      const user = ensureEconomyUser(ctx)
      addCoins(user, 2000)
      riddles.delete(ctx.m.chat)
      ctx.db.scheduleSave()
      await ctx.reply(`🎉 ¡Correcto! Era *${current.answer}*. Ganaste *${formatCoins(2000)} coins*.`)
    },
  },
  rewardGame('pescar', 'Pesca y vende tu captura.', ['Pescaste un pez dorado', 'Encontraste una perla en la orilla', 'Tu red volvió llena']),
  rewardGame('miner', 'Trabaja en la mina por coins.', ['Encontraste un filón de hierro', 'Picaste una veta brillante', 'Descubriste una cueva mineral']),
  rewardGame('suerte', 'Prueba tu suerte.', ['La fortuna te sonríe', 'Encontraste una moneda brillante', 'El destino cambió tu bolsillo'], { min: 50, max: 3000, cooldownMs: 2 * MINUTE, lossRate: 0.5 }),
  rewardGame('crimen', 'Realiza un golpe ficticio con riesgo.', ['El plan salió mejor de lo esperado', 'Una pista falsa cambió el resultado', 'La salida de emergencia funcionó'], { min: 500, max: 4000, cooldownMs: 10 * MINUTE, lossRate: 0.45 }),
  rewardGame('cazar', 'Sal de expedición.', ['La expedición fue un éxito', 'Encontraste un campamento abandonado', 'Volviste con provisiones'], { min: 200, max: 2200 }),
  rewardGame('cofre', 'Abre un cofre cada quince minutos.', ['El cofre tenía monedas antiguas', 'Encontraste un compartimento secreto', 'La cerradura finalmente cedió'], { min: 800, max: 5000, cooldownMs: 15 * MINUTE, lossRate: 0 }),
  {
    commands: ['ppt'],
    category: 'rpg',
    description: 'Juega piedra, papel o tijera contra el bot.',
    usage: '<piedra/papel/tijera>',
    async execute(ctx) {
      const options = ['piedra', 'papel', 'tijera']
      const choice = normalizeCommand(ctx.args[0])
      if (!options.includes(choice)) return ctx.reply(`☾ Usa *${ctx.usedPrefix}ppt piedra|papel|tijera*.`)
      const bot = options[Math.floor(randomFrom(ctx) * options.length)] || options[0]
      const wins = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' }
      const result = choice === bot ? 'Empate' : wins[choice] === bot ? 'Ganaste' : 'Perdiste'
      if (result === 'Ganaste') {
        const user = ensureEconomyUser(ctx)
        addCoins(user, 1000)
        ctx.db.scheduleSave()
      }
      await ctx.reply(`✊ *PIEDRA, PAPEL O TIJERA*\n> Tú: ${choice}\n> Bot: ${bot}\n> Resultado: *${result}*${result === 'Ganaste' ? ' · +1000 coins' : ''}`)
    },
  },
  {
    commands: ['ahorcado'],
    category: 'rpg',
    description: 'Juega al ahorcado por letras o palabra completa.',
    usage: '[letra/palabra/reiniciar]',
    async execute(ctx) {
      const input = normalizeCommand(ctx.text)
      let game = hangmanGames.get(ctx.m.chat)
      if (!game || input === 'reiniciar') {
        const word = WORDS[Math.floor(randomFrom(ctx) * WORDS.length)] || WORDS[0]
        game = { word, guessed: new Set(), failures: 0, maxFailures: 6 }
        hangmanGames.set(ctx.m.chat, game)
      } else if (input) {
        if (input.length === 1 && /^[a-z]$/.test(input)) {
          if (game.word.includes(input)) game.guessed.add(input)
          else game.failures += 1
        } else if (input === game.word) {
          for (const letter of game.word) game.guessed.add(letter)
        } else game.failures += 1
      }
      const view = hangmanView(game)
      const won = view.missing.length === 0
      const lost = game.failures >= game.maxFailures
      if (won || lost) {
        hangmanGames.delete(ctx.m.chat)
        if (won) {
          const user = ensureEconomyUser(ctx)
          addCoins(user, 3000)
          ctx.db.scheduleSave()
        }
      }
      await ctx.reply(
        `🎮 *AHORCADO*\n> ${view.word}\n> Errores: ${game.failures}/${game.maxFailures}\n` +
        (won ? `🎉 Ganaste *${formatCoins(3000)} coins*.` : lost ? `☾ Perdiste. La palabra era *${game.word}*.` : `Usa *${ctx.usedPrefix}ahorcado <letra>*.`),
      )
    },
  },
  {
    commands: ['prestamo'],
    category: 'rpg',
    description: 'Solicita un préstamo con interés del diez por ciento.',
    usage: '<cantidad> <días>',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (user.loan) return ctx.reply(`☾ Ya tienes un préstamo activo; usa *${ctx.usedPrefix}pagar*.`)
      const amount = parseCoins(ctx.args[0])
      const days = Number(ctx.args[1])
      if (!amount || amount > 100000 || !Number.isInteger(days) || days < 1 || days > 30) {
        return ctx.reply(`☾ Usa *${ctx.usedPrefix}prestamo <cantidad hasta 100000> <días 1-30>*.`)
      }
      const now = nowFrom(ctx)
      user.loan = { amount, repayment: Math.ceil(amount * 1.1), days, createdAt: now, dueAt: now + days * DAY }
      addCoins(user, amount)
      ctx.db.scheduleSave()
      await ctx.reply(`🏦 Recibiste *${formatCoins(amount)} coins*.\n> Deuda: *${formatCoins(user.loan.repayment)} coins*\n> Usa *${ctx.usedPrefix}pagar*.`)
    },
  },
  {
    commands: ['pagar'],
    category: 'rpg',
    description: 'Paga tu préstamo activo.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (!user.loan) return ctx.reply('☾ No tienes préstamos activos.')
      const amount = Number(user.loan.repayment) || 0
      if (!spendCoins(user, amount)) return ctx.reply(`☾ Necesitas *${formatCoins(amount)} coins*; tienes *${formatCoins(totalCoinsOf(user))}*.`)
      delete user.loan
      ctx.db.scheduleSave()
      await ctx.reply(`🏦 Préstamo pagado: *${formatCoins(amount)} coins*.`)
    },
  },
  {
    commands: ['robar'],
    category: 'rpg',
    description: 'Intenta robar coins a otro usuario.',
    usage: '[@usuario]',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (!await cooldown(ctx, user, 'robar', 15 * MINUTE)) return
      const target = requestedTargets(ctx, { text: false })[0]
      if (target && (sameUser(target, ctx.userKey) || sameUser(target, ctx.m.sender))) return ctx.reply('☾ No puedes robarte a ti mismo.')
      const success = randomFrom(ctx) < 0.5
      if (target && success) {
        const key = economyUserKey(ctx.db.data.users, target)
        const victim = ensureEconomyUser(ctx, key)
        const amount = Math.min(walletOf(victim), 100 + Math.floor(randomFrom(ctx) * 1400))
        if (!amount) return ctx.reply('☾ Ese usuario no tiene coins en su cartera.')
        victim.coins = walletOf(victim) - amount
        addCoins(user, amount)
        ctx.db.scheduleSave()
        return ctx.reply(`💰 Robaste *${formatCoins(amount)} coins* a @${cleanNumber(target)}.`, { contextInfo: { mentionedJid: [target] } })
      }
      const amount = 100 + Math.floor(randomFrom(ctx) * 900)
      const delta = changeWallet(user, success ? amount : -Math.min(walletOf(user), Math.ceil(amount / 2)))
      ctx.db.scheduleSave()
      await ctx.reply(success ? `💰 El robo ficticio salió bien: *+${formatCoins(delta)} coins*.` : `🚨 Fallaste y perdiste *${formatCoins(Math.abs(delta))} coins*.`)
    },
  },
  rewardGame('sorpresa', 'Recibe una sorpresa cada hora.', ['Un sobre sorpresa tenía coins', 'Un regalo inesperado llegó a tu inventario', 'Encontraste una recompensa especial'], { min: 500, max: 6000, cooldownMs: 60 * MINUTE, lossRate: 0 }),
]
