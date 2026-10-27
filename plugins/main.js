import os from 'node:os'
import { deliverMenu } from '../src/interactive.js'
import { buildSelectedCategory, findCategory } from '../src/menu.js'
import { formatBytes, formatUptime, truncate } from '../src/utils/format.js'

export default [
  {
    commands: ['menu', 'help', 'menú'],
    category: 'general',
    description: 'Muestra el menú o una categoría.',
    usage: '[categoría]',
    needsGroupMetadata: true,
    async execute(ctx) {
      if (ctx.text) {
        const category = findCategory(ctx, ctx.text)
        if (category) return ctx.reply(buildSelectedCategory(ctx, category))
        return ctx.reply(`☾ Categoría no encontrada. Usa ${ctx.usedPrefix}menu para ver las disponibles.`)
      }
      return deliverMenu(ctx)
    },
  },
  {
    commands: ['ping', 'p'],
    category: 'general',
    description: 'Comprueba la latencia del bot.',
    async execute(ctx) {
      const started = Date.now()
      await ctx.react('⚡')
      await ctx.reply(`☾ *Pong*\n> Latencia: ${Date.now() - started} ms\n> Activo: ${formatUptime(Date.now() - ctx.startedAt)}`)
    },
  },
  {
    commands: ['infobot', 'info', 'estado'],
    category: 'general',
    description: 'Información técnica del bot.',
    async execute(ctx) {
      const memory = process.memoryUsage()
      await ctx.reply(`☾ *${ctx.config.botName}*

> Versión del bot: 1.0.0
> Baileys: Multi Device
> Node.js: ${process.version}
> Plataforma: ${process.platform} ${os.arch()}
> Activo: ${formatUptime(Date.now() - ctx.startedAt)}
> Plugins: ${ctx.registry.count}
> RAM usada: ${formatBytes(memory.rss)}
> Comandos ejecutados: ${ctx.db.data.stats.totalCommands}
> API: ${ctx.config.api.baseUrl}`)
    },
  },
  {
    commands: ['estadoapi', 'api'],
    category: 'general',
    description: 'Comprueba el estado de Velirius API.',
    async execute(ctx) {
      await ctx.react('🛰️')
      const docs = await ctx.api.json('/docs', {}, { timeoutMs: 20000 })
      await ctx.reply(`☾ *VELIRIUS API*\n> Estado: En línea\n> Categorías: ${docs.routers || docs.categories?.length || 0}\n> Endpoints: ${docs.endpoints || 'Disponibles'}\n> Token: No requerido\n${ctx.config.api.baseUrl}/home`)
    },
  },
  {
    commands: ['owner', 'creador', 'propietario'],
    category: 'general',
    description: 'Muestra los propietarios del bot.',
    async execute(ctx) {
      const owners = ctx.config.owners.map(owner => `> ${owner.name}\nhttps://wa.me/${owner.number}`)
      const lids = ctx.config.ownerLids.map(lid => `> Owner LID: ${lid}`)
      await ctx.reply(`☾ *PROPIETARIOS*\n\n${[...owners, ...lids].join('\n\n')}`)
    },
  },
  {
    commands: ['perfil', 'profile'],
    category: 'general',
    description: 'Muestra tu actividad y rol.',
    needsGroupMetadata: true,
    async execute(ctx) {
      const user = ctx.db.data.users[ctx.m.senderDisplay || ctx.m.sender]
      const role = ctx.isOwner ? 'Propietario' : ctx.isAdmin ? 'Administrador' : 'Usuario'
      await ctx.reply(`☾ *PERFIL DE @${ctx.m.senderDisplay.split('@')[0]}*

> Nombre: ${ctx.m.name}
> Rol: ${role}
> Mensajes: ${user?.messages || 0}
> Comandos: ${user?.commands || 0}
> ID: ${ctx.m.sender}`, {
        contextInfo: { mentionedJid: [ctx.m.sender] },
      })
    },
  },
  {
    commands: ['id', 'myid'],
    category: 'general',
    description: 'Muestra tus identificadores de WhatsApp.',
    async execute(ctx) {
      await ctx.reply(truncate(`☾ *IDENTIFICADORES*\n> Chat: ${ctx.m.chat}\n> Sender: ${ctx.m.sender}\n> PN: ${ctx.m.senderPn || 'No disponible'}\n> Tipo: ${ctx.isGroup ? 'Grupo' : 'Privado'}`, 3000))
    },
  },
]
