import { cleanNumber, formatUptime, memoryUsage, normalizeCommand } from './utils/format.js'

export const MENU_ROW_PREFIX = 'vlrs_menu_'

export const CATEGORIES = {
  general: { label: '𝙶𝙴𝙽𝙴𝚁𝙰𝙻', description: 'Menú, estado y perfil' },
  downloads: { label: '𝙳𝙴𝚂𝙲𝙰𝚁𝙶𝙰𝚂', description: 'Música y videos' },
  search: { label: '𝙱𝚄𝚂𝚀𝚄𝙴𝙳𝙰', description: 'YouTube, Google y más' },
  anime: { label: '𝙰𝙽𝙸𝙼𝙴', description: 'Imágenes y Pokémon' },
  reactions: { label: '𝚁𝙴𝙰𝙲𝙲𝙸𝙾𝙽𝙴𝚂', description: 'GIFs para interactuar' },
  canvas: { label: '𝙲𝙰𝙽𝚅𝙰𝚂', description: 'Imágenes personalizadas' },
  tools: { label: '𝙷𝙴𝚁𝚁𝙰𝙼𝙸𝙴𝙽𝚃𝙰𝚂', description: 'Utilidades de la API' },
  group: { label: '𝙶𝚁𝚄𝙿𝙾', description: 'Administración de grupos' },
  owner: { label: '𝙿𝚁𝙾𝙿𝙸𝙴𝚃𝙰𝚁𝙸𝙾', description: 'Configuración del bot' },
}

const categoryOrder = Object.keys(CATEGORIES)
const moon = '𓂃 ࣪ ִֶָ☾.'

export function availablePlugins(ctx) {
  return ctx.registry.list.filter(plugin => {
    if (plugin.owner && !ctx.isOwner) return false
    if (plugin.admin && !ctx.isOwner && !ctx.isAdmin) return false
    return true
  })
}

export function pluginsByCategory(ctx) {
  const grouped = new Map()
  for (const plugin of availablePlugins(ctx)) {
    const category = CATEGORIES[plugin.category] ? plugin.category : 'general'
    if (!grouped.has(category)) grouped.set(category, [])
    grouped.get(category).push(plugin)
  }
  return categoryOrder.filter(category => grouped.has(category)).map(category => ({
    id: category,
    ...CATEGORIES[category],
    plugins: grouped.get(category).sort((a, b) => a.commands[0].localeCompare(b.commands[0])),
  }))
}

export function buildMenuHeader(ctx) {
  const { config, m } = ctx
  const user = cleanNumber(m.senderDisplay) || m.name
  const owners = config.owners.map(owner =>
    `> ${moon}  ⊹ wa.me/${owner.number} ⊹ *${owner.name}*`)
  const lids = config.ownerLids.map((lid, index) =>
    `> ${moon}  ⊹ LID ${lid} ⊹ *Owner ${index + 1}*`)
  const role = ctx.isOwner ? '👑 Propietario' : ctx.isAdmin ? '🛡️ Administrador' : '👤 Usuario'

  return `${moon} 𝙱𝙸𝙴𝙽𝚅𝙴𝙽𝙸𝙳𝙾/𝙰  @${user}

   𓍯  𝙸𝙽𝙵𝙾 𝚄𝚂𝚄𝙰𝚁𝙸𝙾  𓍯

> ${moon}  𝚁𝙾𝙻:  ${role}
> ${moon}  𝙱𝙾𝚃:  ${config.botName}
> ${moon}  𝚃𝙸𝙿𝙾:  Multi Device
> ${moon}  𝚃𝙸𝙴𝙼𝙿𝙾 𝙰𝙲𝚃𝙸𝚅𝙾:  ${formatUptime(Date.now() - ctx.startedAt)}
> ${moon}  𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂:  ${availablePlugins(ctx).length}
> ${moon}  𝙼𝙴𝙼𝙾𝚁𝙸𝙰:  ${memoryUsage()}

 ${moon} 𝙿𝚁𝙾𝙿𝙸𝙴𝚃𝙰𝚁𝙸𝙾𝚂 ${moon}
${[...owners, ...lids].join('\n')}`.trim()
}

export function commandExample(plugin, prefix) {
  return `> • ${prefix}${plugin.commands[0]}${plugin.usage ? ` ${plugin.usage}` : ''}`
}

export function buildCategoryText(category, prefix) {
  return `ー ${category.label} ー\n${category.plugins.map(plugin => commandExample(plugin, prefix)).join('\n')}`
}

export function buildCommandsText(ctx) {
  const categories = pluginsByCategory(ctx)
  return `${moon} *𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂* ${moon}\n\n${categories.map(category => buildCategoryText(category, ctx.usedPrefix)).join('\n\n')}`
}

export function buildFullMenu(ctx) {
  return `${buildMenuHeader(ctx)}\n\n${buildCommandsText(ctx)}`
}

export function buildMenuSections(ctx, native = false) {
  return [{
    title: `${moon} 𝙲𝙰𝚃𝙴𝙶𝙾𝚁𝙸𝙰𝚂`,
    rows: pluginsByCategory(ctx).map(category => ({
      ...(native ? { header: '', id: `${MENU_ROW_PREFIX}${category.id}` } : { rowId: `${MENU_ROW_PREFIX}${category.id}` }),
      title: category.label,
      description: `${category.description} · ${category.plugins.length} comandos`,
    })),
  }]
}

export function categoryFromSelection(selectionId = '') {
  return selectionId.startsWith(MENU_ROW_PREFIX)
    ? selectionId.slice(MENU_ROW_PREFIX.length)
    : ''
}

export function findCategory(ctx, value = '') {
  const wanted = normalizeCommand(value)
  return pluginsByCategory(ctx).find(category =>
    normalizeCommand(category.id) === wanted || normalizeCommand(category.label) === wanted) || null
}

export function buildSelectedCategory(ctx, category) {
  return `${moon} *${category.label}* ${moon}\n\n${category.plugins.map(plugin =>
    `${commandExample(plugin, ctx.usedPrefix)}\n  ${plugin.description}`).join('\n\n')}\n\n> Escribe ${ctx.usedPrefix}menu para volver.`
}
