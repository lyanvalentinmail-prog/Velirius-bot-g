import { rm } from 'node:fs/promises'
import path from 'node:path'
import { formatUptime } from '../src/utils/format.js'

export default [
  {
    commands: ['delsession'],
    category: 'owners',
    description: 'Elimina la sesión principal y reinicia para vincular de nuevo.',
    owner: true,
    async execute(ctx) {
      const directory = path.resolve(ctx.config.sessionDir)
      if (directory === path.parse(directory).root || directory === process.cwd()) {
        return ctx.reply('☾ La ruta de sesión no es segura; revisa sessionDir.')
      }
      await ctx.reply('☾ Sesión eliminada. El bot se reiniciará para solicitar una nueva vinculación.')
      setTimeout(async () => {
        await rm(directory, { recursive: true, force: true }).catch(() => {})
        ctx.runtime.restart?.()
      }, 700).unref?.()
    },
  },
  {
    commands: ['join'],
    category: 'owners',
    description: 'Une el bot a un grupo mediante invitación.',
    usage: '<link>',
    owner: true,
    mod: true,
    async execute(ctx) {
      const match = /(?:chat\.whatsapp\.com\/(?:invite\/)?)?([A-Za-z0-9]{10,})/.exec(ctx.text)
      if (!match) return ctx.reply(`☾ Usa *${ctx.usedPrefix}join <link de invitación>*.`)
      const group = await ctx.sock.groupAcceptInvite(match[1])
      await ctx.reply(`☾ Invitación aceptada${group ? `: ${group}` : '.'}`)
    },
  },
  {
    commands: ['bot'],
    category: 'subbot',
    description: 'Activa, pausa o muestra información del bot.',
    usage: '<on/off/info>',
    async execute(ctx) {
      const action = String(ctx.args[0] || 'info').toLowerCase()
      if (['on', 'off'].includes(action)) {
        if (!ctx.isOwner && !ctx.isMod) return ctx.reply('☾ Sólo owners o moderadores pueden cambiar el estado del bot.')
        await ctx.configStore.update(config => { config.mode = action === 'on' ? 'public' : 'self' })
        return ctx.reply(`☾ Bot: *${action.toUpperCase()}*`)
      }
      if (action !== 'info') return ctx.reply(`☾ Usa *${ctx.usedPrefix}bot on*, *off* o *info*.`)
      const subbots = ctx.runtime.subbots?.list?.() || []
      await ctx.reply(
        `☾ *INFORMACIÓN DEL BOT*\n> Nombre: ${ctx.config.botName}\n> Tipo: Multi Device\n` +
        `> Activo: ${formatUptime(Date.now() - ctx.startedAt)}\n> Comandos: ${ctx.registry.count}\n` +
        `> Modo: ${ctx.config.mode}\n> Subbots: ${subbots.filter(bot => bot.status === 'open').length}`,
      )
    },
  },
  {
    commands: ['setlen'],
    category: 'owners',
    description: 'Cambia el idioma predeterminado del bot.',
    usage: '<es/in/pt>',
    owner: true,
    mod: true,
    async execute(ctx) {
      const language = String(ctx.args[0] || '').toLowerCase()
      if (!['es', 'in', 'pt'].includes(language)) return ctx.reply(`☾ Usa *${ctx.usedPrefix}setlen es/in/pt*.`)
      await ctx.configStore.update(config => { config.language = language })
      await ctx.reply(`☾ Idioma predeterminado: *${language}*.`)
    },
  },
]
