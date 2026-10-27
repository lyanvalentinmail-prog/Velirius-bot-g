import { collectionUnits } from '../src/utils/characters.js'
import {
  ensureEconomyUser,
  economyUserKey,
  formatCoins,
  nowFrom,
  totalCoinsOf,
} from '../src/utils/economy.js'
import { cleanNumber, truncate } from '../src/utils/format.js'
import { requestedTargets } from '../src/utils/group.js'
import { hasOwnerIdentity, sameUser } from '../src/utils/jid.js'

function pokemonUnits(user) {
  return Array.isArray(user.pokemon)
    ? user.pokemon.reduce((total, pokemon) => total + (Number(pokemon.count) || 1), 0)
    : 0
}

function saveProfile(ctx, message) {
  ctx.db.scheduleSave()
  return ctx.reply(message)
}

function validBirth(value) {
  const match = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(String(value || '').trim())
  if (!match) return ''
  const day = Number(match[1])
  const month = Number(match[2])
  const year = match[3] ? Number(match[3]) : 2000
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}${match[3] ? `/${match[3]}` : ''}`
}

function birthParts(value) {
  const [day, month] = String(value || '').split('/').map(Number)
  return day >= 1 && month >= 1 ? { day, month } : null
}

export default [
  {
    commands: ['perfil', 'profile'],
    category: 'perfil',
    description: 'Muestra tu perfil RPG o el de otro usuario.',
    usage: '[@usuario]',
    needsGroupMetadata: true,
    async execute(ctx) {
      const target = requestedTargets(ctx, { text: false })[0] || ctx.m.sender
      const key = economyUserKey(ctx.db.data.users, target)
      const user = ensureEconomyUser(ctx, key)
      const self = sameUser(target, ctx.m.sender) || sameUser(target, ctx.userKey)
      const role = hasOwnerIdentity([target], ctx.config)
        ? '👑 Propietario'
        : self && ctx.isAdmin ? '🛡️ Administrador' : '👤 Usuario'
      const caption = truncate(
        `☾ *PERFIL DE @${cleanNumber(target)}*\n\n` +
        `> Nombre: *${user.name || (self ? ctx.m.name : 'Usuario')}*\n` +
        `> Género: ${user.genre || 'No establecido'} · Edad: ${user.age || 'Sin registrar'}\n` +
        `> Pareja: ${user.spouse ? `@${cleanNumber(user.spouse)}` : 'Sin pareja'}\n` +
        `> Cumpleaños: ${user.birth || 'No registrado'}\n` +
        `> Descripción: ${user.desc || 'Sin descripción'}\n` +
        `> Favorito: ${user.favourite || 'No establecido'}\n\n` +
        `> Rol: ${role}\n> Coins: ${formatCoins(totalCoinsOf(user))}\n` +
        `> Personajes: ${collectionUnits(user)} · Pokémon: ${pokemonUnits(user)}\n` +
        `> Mensajes: ${user.messages || 0} · Comandos: ${user.commands || 0}\n` +
        `> ID: ${target}`,
        5000,
      )
      const contextInfo = { mentionedJid: [target] }
      const photo = ctx.sock?.profilePictureUrl
        ? await ctx.sock.profilePictureUrl(target, 'image').catch(() => '')
        : ''
      if (photo) return ctx.send({ image: { url: photo }, caption, contextInfo })
      return ctx.reply(caption, { contextInfo })
    },
  },
  {
    commands: ['setdesc', 'setdescription'],
    category: 'perfil',
    description: 'Establece la descripción de tu perfil.',
    usage: '<descripción>',
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Usa *${ctx.usedPrefix}setdesc <descripción>*.`)
      const user = ensureEconomyUser(ctx)
      user.desc = truncate(ctx.text, 200)
      await saveProfile(ctx, '☾ Descripción de perfil actualizada.')
    },
  },
  {
    commands: ['setfav', 'setfavourite'],
    category: 'perfil',
    description: 'Establece tu personaje o ídolo favorito.',
    usage: '<personaje>',
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Usa *${ctx.usedPrefix}setfav <personaje>*.`)
      const user = ensureEconomyUser(ctx)
      user.favourite = truncate(ctx.text, 80)
      await saveProfile(ctx, `☾ Favorito guardado como *${user.favourite}*.`)
    },
  },
  {
    commands: ['setname', 'cambiarnombre', 'nombre'],
    category: 'perfil',
    description: 'Cambia el nombre visible de tu perfil.',
    usage: '<nombre>',
    async execute(ctx) {
      const name = ctx.text.trim()
      if (name.length < 2 || name.length > 14) return ctx.reply('☾ El nombre debe tener entre 2 y 14 caracteres.')
      const duplicate = Object.entries(ctx.db.data.users).some(([jid, user]) =>
        !sameUser(jid, ctx.userKey) && String(user.name || '').toLowerCase() === name.toLowerCase())
      if (duplicate) return ctx.reply('☾ Ese nombre ya está utilizado por otro usuario.')
      const user = ensureEconomyUser(ctx)
      const previous = user.name || ctx.m.name
      user.name = name
      user.customName = true
      await saveProfile(ctx, `☾ Nombre actualizado: *${previous}* → *${name}*.`)
    },
  },
  {
    commands: ['setage'],
    category: 'perfil',
    description: 'Guarda tu edad en el perfil.',
    usage: '<edad>',
    async execute(ctx) {
      const age = Number(ctx.args[0])
      if (!Number.isInteger(age) || age < 1 || age > 120) return ctx.reply(`☾ Usa *${ctx.usedPrefix}setage <edad de 1 a 120>*.`)
      const user = ensureEconomyUser(ctx)
      user.age = age
      await saveProfile(ctx, `☾ Edad guardada: *${age} años*.`)
    },
  },
  {
    commands: ['marry'],
    category: 'perfil',
    description: 'Registra una pareja en ambos perfiles.',
    usage: '<@usuario>',
    async execute(ctx) {
      const target = requestedTargets(ctx, { text: false })[0]
      if (!target) return ctx.reply(`☾ Usa *${ctx.usedPrefix}marry @usuario*.`)
      if (sameUser(target, ctx.userKey) || sameUser(target, ctx.m.sender)) return ctx.reply('☾ No puedes casarte contigo mismo.')
      const user = ensureEconomyUser(ctx)
      const targetKey = economyUserKey(ctx.db.data.users, target)
      const partner = ensureEconomyUser(ctx, targetKey)
      if (user.spouse || partner.spouse) return ctx.reply('☾ Tú o esa persona ya tienen una pareja registrada; primero usa divorce.')
      user.spouse = target
      partner.spouse = ctx.userKey
      ctx.db.scheduleSave()
      await ctx.reply(`💍 @${cleanNumber(ctx.m.senderDisplay)} y @${cleanNumber(target)} ahora están casados.`, {
        contextInfo: { mentionedJid: [ctx.m.sender, target] },
      })
    },
  },
  {
    commands: ['divorce'],
    category: 'perfil',
    description: 'Elimina la pareja de ambos perfiles.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (!user.spouse) return ctx.reply('☾ No tienes una pareja registrada.')
      const partnerKey = economyUserKey(ctx.db.data.users, user.spouse)
      const partner = ctx.db.data.users[partnerKey]
      const previous = user.spouse
      if (partner) delete partner.spouse
      delete user.spouse
      ctx.db.scheduleSave()
      await ctx.reply(`☾ Se disolvió el matrimonio con @${cleanNumber(previous)}.`, {
        contextInfo: { mentionedJid: [previous] },
      })
    },
  },
  {
    commands: ['setgenre'],
    category: 'perfil',
    description: 'Establece el género de tu perfil.',
    usage: '<hombre/mujer>',
    async execute(ctx) {
      const genre = String(ctx.args[0] || '').toLowerCase()
      if (!['hombre', 'mujer'].includes(genre)) return ctx.reply(`☾ Usa *${ctx.usedPrefix}setgenre <hombre/mujer>*.`)
      const user = ensureEconomyUser(ctx)
      user.genre = genre
      await saveProfile(ctx, `☾ Género establecido en *${genre}*.`)
    },
  },
  {
    commands: ['delgenre'],
    category: 'perfil',
    description: 'Elimina el género de tu perfil.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (!user.genre) return ctx.reply('☾ No tienes un género establecido.')
      delete user.genre
      await saveProfile(ctx, '☾ Género eliminado del perfil.')
    },
  },
  {
    commands: ['setbirth'],
    category: 'perfil',
    description: 'Guarda tu fecha de cumpleaños.',
    usage: '<día/mes[/año]>',
    async execute(ctx) {
      const birth = validBirth(ctx.text)
      if (!birth) return ctx.reply(`☾ Fecha inválida. Usa *${ctx.usedPrefix}setbirth 25/12* o *25/12/2000*.`)
      const user = ensureEconomyUser(ctx)
      user.birth = birth
      await saveProfile(ctx, `☾ Cumpleaños guardado: *${birth}*.`)
    },
  },
  {
    commands: ['delbirth'],
    category: 'perfil',
    description: 'Elimina tu fecha de cumpleaños.',
    async execute(ctx) {
      const user = ensureEconomyUser(ctx)
      if (!user.birth) return ctx.reply('☾ No tienes un cumpleaños registrado.')
      delete user.birth
      await saveProfile(ctx, '☾ Cumpleaños eliminado del perfil.')
    },
  },
  {
    commands: ['birthdays', 'cumpleaños', 'births'],
    category: 'perfil',
    description: 'Muestra los cumpleaños registrados para hoy.',
    async execute(ctx) {
      const now = new Date(nowFrom(ctx))
      const users = Object.entries(ctx.db.data.users).filter(([, user]) => {
        const birth = birthParts(user.birth)
        return birth && birth.day === now.getDate() && birth.month === now.getMonth() + 1
      })
      if (!users.length) return ctx.reply('☾ Hoy no hay cumpleaños registrados.')
      await ctx.reply(
        `🎂 *CUMPLEAÑOS DE HOY*\n${users.map(([jid, user]) =>
          `> • *${user.name || `@${cleanNumber(jid)}`}* · ${user.birth}`).join('\n')}`,
        { contextInfo: { mentionedJid: users.map(([jid]) => jid) } },
      )
    },
  },
  {
    commands: ['allbirthdays', 'allbirths'],
    category: 'perfil',
    description: 'Muestra el calendario de cumpleaños registrados.',
    async execute(ctx) {
      const now = new Date(nowFrom(ctx))
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const users = Object.entries(ctx.db.data.users).filter(([, user]) => birthParts(user.birth))
        .map(([jid, user]) => {
          const birth = birthParts(user.birth)
          let next = new Date(now.getFullYear(), birth.month - 1, birth.day).getTime()
          if (next < start) next = new Date(now.getFullYear() + 1, birth.month - 1, birth.day).getTime()
          return { jid, user, next }
        }).sort((a, b) => a.next - b.next)
      if (!users.length) return ctx.reply('☾ No hay cumpleaños registrados.')
      await ctx.reply(truncate(
        `🎂 *CALENDARIO DE CUMPLEAÑOS*\n${users.slice(0, 30).map(({ user }) =>
          `> • *${user.name || 'Usuario'}* · ${user.birth}`).join('\n')}`,
        5000,
      ))
    },
  },
]
