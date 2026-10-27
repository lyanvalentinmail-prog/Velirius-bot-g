import { cleanNumber } from '../src/utils/format.js'
import { groupTarget, requestedTargets } from '../src/utils/group.js'
import { hasOwnerIdentity, identityVariants, sameUser } from '../src/utils/jid.js'

async function targetAction(ctx, action, success) {
  const targets = requestedTargets(ctx)
  if (!targets.length) return ctx.reply(`☾ Menciona, responde o escribe el número del usuario.\nUso: ${ctx.usedPrefix}${ctx.command} ${ctx.plugin.usage}`)
  const target = groupTarget(ctx, targets[0])
  if (action === 'remove' && hasOwnerIdentity(identityVariants(target), ctx.config)) {
    return ctx.reply('☾ No puedes realizar esa acción contra un owner.')
  }
  if (sameUser(target, ctx.sock.user?.id)) return ctx.reply('☾ No puedo realizar esa acción conmigo mismo.')
  const result = await ctx.sock.groupParticipantsUpdate(ctx.m.chat, [target], action)
  const status = Number(result?.[0]?.status || 200)
  if (status >= 400) throw new Error(`WhatsApp rechazó la acción (código ${status}). Revisa el usuario y los permisos.`)
  await ctx.reply(`☾ ${success}: @${cleanNumber(target)}`, {
    contextInfo: { mentionedJid: [target] },
  })
}

const participantCommand = (commands, action, description, success) => ({
  commands,
  category: 'group',
  description,
  usage: '@usuario | número',
  group: true,
  admin: true,
  botAdmin: true,
  execute: ctx => targetAction(ctx, action, success),
})

export default [
  participantCommand(['kick', 'ban', 'expulsar'], 'remove', 'Expulsa a un miembro del grupo.', 'Miembro procesado para expulsión'),
  participantCommand(['add', 'agregar'], 'add', 'Agrega un número al grupo.', 'Solicitud de agregado procesada'),
  participantCommand(['promote', 'promover'], 'promote', 'Convierte a un miembro en administrador.', 'Nuevo administrador'),
  participantCommand(['demote', 'degradar'], 'demote', 'Quita la administración a un miembro.', 'Administración retirada a'),
  {
    commands: ['open', 'abrir', 'grupoabrir'],
    category: 'group',
    description: 'Permite que todos envíen mensajes.',
    group: true,
    admin: true,
    botAdmin: true,
    async execute(ctx) {
      await ctx.sock.groupSettingUpdate(ctx.m.chat, 'not_announcement')
      await ctx.reply('☾ Grupo abierto: todos pueden escribir.')
    },
  },
  {
    commands: ['close', 'cerrar', 'grupocerrar'],
    category: 'group',
    description: 'Permite escribir sólo a administradores.',
    group: true,
    admin: true,
    botAdmin: true,
    async execute(ctx) {
      await ctx.sock.groupSettingUpdate(ctx.m.chat, 'announcement')
      await ctx.reply('☾ Grupo cerrado: sólo administradores pueden escribir.')
    },
  },
  {
    commands: ['setgroupname', 'namegp'],
    category: 'group',
    description: 'Cambia el nombre del grupo.',
    usage: '<nuevo nombre>',
    group: true,
    admin: true,
    botAdmin: true,
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setgroupname Nuevo nombre`)
      await ctx.sock.groupUpdateSubject(ctx.m.chat, ctx.text.slice(0, 100))
      await ctx.reply('☾ Nombre del grupo actualizado.')
    },
  },
  {
    commands: ['setgroupdesc', 'desgp'],
    category: 'group',
    description: 'Cambia la descripción del grupo.',
    usage: '<descripción>',
    group: true,
    admin: true,
    botAdmin: true,
    async execute(ctx) {
      if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setgroupdesc Nueva descripción`)
      await ctx.sock.groupUpdateDescription(ctx.m.chat, ctx.text.slice(0, 2048))
      await ctx.reply('☾ Descripción actualizada.')
    },
  },
  {
    commands: ['tagall', 'todos', 'hidetag'],
    category: 'group',
    description: 'Menciona a todos los miembros.',
    usage: '[mensaje]',
    group: true,
    admin: true,
    async execute(ctx) {
      const mentions = ctx.participants.map(participant => participant.id).filter(Boolean)
      const list = mentions.map(jid => `@${cleanNumber(jid)}`).join(' ')
      await ctx.send({
        text: `☾ *MENCIÓN GENERAL*\n${ctx.text ? `\n${ctx.text}\n` : ''}\n${list}`,
        contextInfo: { mentionedJid: mentions },
      })
    },
  },
  {
    commands: ['delete', 'del', 'borrar'],
    category: 'group',
    description: 'Elimina el mensaje respondido.',
    group: true,
    admin: true,
    botAdmin: true,
    async execute(ctx) {
      if (!ctx.m.quoted?.key?.id) return ctx.reply('☾ Responde al mensaje que quieres eliminar.')
      const key = {
        ...ctx.m.quoted.key,
        fromMe: sameUser(ctx.m.quoted.sender, ctx.sock.user?.id),
      }
      await ctx.send({ delete: key })
    },
  },
  {
    commands: ['link', 'enlace', 'grouplink'],
    category: 'group',
    description: 'Obtiene el enlace de invitación.',
    group: true,
    admin: true,
    botAdmin: true,
    async execute(ctx) {
      const code = await ctx.sock.groupInviteCode(ctx.m.chat)
      await ctx.reply(`☾ Enlace del grupo:\nhttps://chat.whatsapp.com/${code}`)
    },
  },
  {
    commands: ['infogroup', 'infogrupo'],
    category: 'group',
    description: 'Muestra información del grupo.',
    group: true,
    async execute(ctx) {
      const metadata = ctx.groupMetadata
      await ctx.reply(`☾ *${metadata.subject}*\n> ID: ${ctx.m.chat}\n> Miembros: ${ctx.participants.length}\n> Administradores: ${ctx.participants.filter(p => p.admin).length}\n> Creación: ${metadata.creation ? new Date(metadata.creation * 1000).toLocaleString('es-UY') : 'Desconocida'}\n> Descripción:\n${metadata.desc || 'Sin descripción'}`)
    },
  },
]
