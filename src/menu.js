import { cleanNumber, formatUptime, memoryUsage, normalizeCommand } from './utils/format.js'

export const MENU_ROW_PREFIX = 'vlrs_menu_'

export const CATEGORIES = {
  general: { label: 'General', description: 'Menú, estado y propietarios' },
  owners: { label: 'owners', description: 'Configuración y moderadores' },
  admins: { label: 'admins', description: 'Administración de grupos' },
  antis: { label: 'antis', description: 'Reglas automáticas', parent: 'Admins', subcategory: true },
  subbot: { label: 'Sub bot', description: 'Vinculación y sesiones' },
  rpg: { label: 'juegos rpg', description: 'Economía, juegos y gacha' },
  pokemon: { label: 'Pokemon', description: 'Colección y combates', parent: 'Juegos rpg', subcategory: true },
  perfil: { label: 'perfil', description: 'Datos personales y pareja' },
  tops: { label: 'tops', description: 'Rankings de actividad y coins' },
  searcher: { label: 'busquedas', description: 'Búsquedas web y sociales' },
  downloader: { label: 'descargas', description: 'Descargas de medios' },
  reactions: { label: 'reacciones', description: 'GIFs de reacciones SFW' },
  additional: { label: 'adicionales', description: 'Notas y herramientas' },
  stickersmaker: { label: 'Sticker maker', description: 'Generadores de stickers', parent: 'Stickers', parentHeader: 'stickers', subcategory: true },
  stickerseditor: { label: 'Sticker editor', description: 'Edición y paquetes', parent: 'Stickers', subcategory: true },
  diversion: { label: 'diversion', description: 'Tops y entretenimiento' },
  canvas: { label: 'Canvas', description: 'Imágenes personalizadas' },
  effects: { label: 'Imagenes', description: 'Efectos para imágenes' },
}

const item = (command, display = '', extra = {}) => ({ command, ...(display ? { display } : {}), ...extra })
const reactions = [
  'hug', 'kiss', 'pat', 'slap', 'cuddle', 'wave', 'wink', 'blush', 'smile', 'happy', 'dance', 'cry',
  'poke', 'tickle', 'highfive', 'handhold', 'nom', 'bite', 'bonk', 'baka', 'smug', 'laugh', 'shrug',
  'sleep', 'think', 'thumbsup',
]

export const MENU_LAYOUT = [
  ['general', ['estadoapi', 'id', 'infobot', item('menu', 'menu <categoría>'), 'owner', 'ping']],
  ['owners', [
    item('mod', 'mod @usuario / número'), item('mod', 'mod del @usuario'), item('mod', 'mod lista'),
    'delsession', item('join', 'join <link>'), item('bot', 'bot on', { owner: true }),
    item('bot', 'bot off', { owner: true }), item('setlen', 'setlen es/in/pt'), item('setmenu', 'setmenu lista/texto'),
  ]],
  ['admins', [
    item('ban', 'ban @usuario / responder'), item('sban', 'sban → sticker ban (responder sticker)'),
    item('warn', 'warn @usuario / responder'), item('delwarn', 'delwarn'), item('warnings', 'warnings @usuario / responder'),
    item('mute', 'mute @usuario / responder'), item('delmute', 'delmute @usuario / responder'), 'open', 'close',
    item('fijar', 'fijar'), item('desfijar', 'desfijar'), item('namegp', 'namegp <nombre>'), item('desgp', 'desgp <descripción>'), item('photogp', 'photogp'),
    item('grupo', 'grupo on/off'), item('soloadmin', 'soloadmin on/off'), item('welcome', 'welcome on/off'),
  ]],
  ['antis', [
    item('antilink', 'antilink on/off'), item('antiimg', 'antiimg on/off'), item('antiaudio', 'antiaudio on/off'),
    item('antivideo', 'antivideo on/off'), item('antisticker', 'antisticker on/off'), item('antispam', 'antispam on/off'),
    item('antibot', 'antibot on/off'), item('antidelete', 'antidelete on/off'), item('antidocs', 'antidocs on/off'),
    item('antipalabras', 'antipalabras on/off'), item('antipalabra', 'antipalabra del <palabra>'),
    item('antipalabra', 'antipalabra add <palabra>'),
  ]],
  ['subbot', [
    'qr', 'code', 'bots', item('bot', 'bot info'), item('setbotname', 'setbotname'), item('setbotimg', 'setbotimg'),
    item('autoread', 'autoread on/off'), item('setlen', 'setlen es/in/pt'), item('setmenu', 'setmenu lista/texto'),
  ]],
  ['rpg', [
    item('balance', 'balance'), 'coins', item('transf', 'transf @usuario <cantidad>'), 'dado', 'daily', item('adivinanza', 'adivinanza'), 'pescar', 'miner',
    'work', 'suerte', 'crimen', 'cazar', 'cofre', item('ppt', 'ppt piedra|papel|tijera'), item('ahorcado', 'ahorcado'), 'banco',
    item('deposit', 'deposit <cantidad/all>'), item('change', 'change <banco>'), item('unirsebank', 'unirsebank <banco>'),
    item('prestamo', 'prestamo <cantidad> <días>'), 'pagar', item('robar', 'robar'), 'sorpresa', item('w', 'w / rw'),
    item('claim', 'claim / c'), 'tiendag', item('comprarg', 'comprarg <orden>'),
  ]],
  ['pokemon', ['catch', item('pokedex', 'pokedex <nombre/ID/random>'), item('pokemonbattle', 'pokemonbattle <@usuario>')]],
  ['perfil', [
    item('perfil', 'perfil'), item('setbirth', 'setbirth <fecha>'), item('setage', 'setage <edad>'), item('setdesc', 'setdesc <descripción>'),
    item('setfav', 'setfav <personaje>'), item('setgenre', 'setgenre <hombre/mujer>'), 'birthdays', item('marry', 'marry @user'), 'divorce',
  ]],
  ['tops', ['topcoins', 'topinactivos', 'topactivos']],
  ['searcher', [
    item('google', 'google <búsqueda>'), item('pinterest', 'pinterest <búsqueda>'), item('tiktok', 'tiktok <búsqueda>'),
    item('wiki', 'wiki <búsqueda>'), item('youtube', 'youtube <búsqueda>'),
  ]],
  ['downloader', [
    item('facebook', 'facebook <URL>'), item('instagram', 'instagram <URL>'), item('letra', 'letra <artista y canción>'),
    item('mp3', 'mp3 <URL o búsqueda>'), item('mp4', 'mp4 <URL o búsqueda>'), item('pinterest', 'pinterest <URL>'),
    item('play', 'play <canción o artista>'), item('tiktok', 'tiktok <URL>'), item('tiktokaudio', 'tiktokaudio <URL>'),
  ]],
  ['reactions', reactions.map(command => item(command, `${command} [@usuario]`))],
  ['additional', [
    item('nota', 'nota <contenido>'), item('delnota', 'delnota <numero>'), 'infogrupo', item('reveal', 'reveal <responder>'),
    item('translate', 'translate es/in/pt <texto>'), item('calculator', 'calculator <operación>'),
    item('resize', 'resize <imagen/sticker> 800x600'), item('tts', 'tts <texto>'), item('stt', 'stt <nota de voz/audio>'),
  ]],
  ['stickersmaker', [
    item('brat', 'brat/bratv <texto>'), item('bratestirado', 'bratestirado <texto>'), item('sgay', 'sgay <foto> <texto>'),
    item('attp', 'attp <texto>'), item('ttp', 'ttp <texto>'), item('bobesponja', 'bobesponja <1/2/3> <texto>'),
    item('bratcoyote', 'bratcoyote <texto>'), item('bratanime', 'bratanime <texto>'),
    item('bratpinguino', 'bratpinguino <texto>'), item('bratboy', 'bratboy <texto>'),
  ]],
  ['stickerseditor', [
    item('sticker', 'sticker <responder>'), item('pack', 'pack <nombre.autor>'), item('toimg', 'toimg/tovid <responder>'),
  ]],
  ['diversion', [
    item('ship', 'ship <@usuario> <@usuario>'), 'topgays', 'topotakus', 'topfemboys', 'meme',
  ]],
  ['canvas', [
    item('canvaimagen', 'canvaimagen <responder>'), item('cuentatiktok', 'cuentatiktok <texto> <responder>'),
    item('friendship', 'friendship <@usuario> <@usuario>'), item('gaycard', 'gaycard <@usuario>'),
    item('googleimg', 'googleimg <responder>'), item('iqc', 'iqc <texto>'), item('iqcblue', 'iqcblue <texto>'),
    item('iqcpink', 'iqcpink <texto>'), item('laptop', 'laptop <responder>'), item('messengerquote', 'messengerquote <texto>'),
    item('pc', 'pc <responder>'), item('pov', 'pov <texto> <responder>'), item('profilenote', 'profilenote <texto>'),
    item('quotly', 'quotly <texto>'), item('searched', 'searched <imagen>'), item('storyreply', 'storyreply <texto>'), item('x', 'x <texto>'),
  ]],
  ['effects', [
    item('blur', 'blur <responder> <intensidad>'), item('deepfry', 'deepfry <responder> <intensidad>'),
    item('gay', 'gay <responder> <intensidad>'), item('glitch', 'glitch <responder> <intensidad>'),
    item('grayscale', 'grayscale <responder> <intensidad>'), item('invert', 'invert <responder>'),
    item('liquify', 'liquify <responder>'), item('pixel', 'pixel <responder>'), item('sketch', 'sketch <responder>'),
    item('swirl', 'swirl <responder> <intensidad>'),
  ]],
]

const CATEGORY_ALIASES = {
  downloads: 'downloader', descargas: 'downloader', search: 'searcher', busqueda: 'searcher', buscador: 'searcher',
  herramientas: 'additional', tools: 'additional', tootles: 'additional', stickers: 'stickersmaker', sticker: 'stickersmaker',
  stickereditor: 'stickerseditor', efectos: 'effects', imagenes: 'effects', reactions: 'reactions', reacciones: 'reactions',
  anime: 'reactions', economy: 'rpg', economia: 'rpg', characters: 'rpg', personajes: 'rpg', gacha: 'rpg',
  profile: 'perfil', grupos: 'admins', group: 'admins', propietario: 'owners', owner: 'owners', subbots: 'subbot',
  diversion: 'diversion', fun: 'diversion', adicionales: 'additional', pokemon: 'pokemon', rpg: 'rpg',
}

const moon = '𓂃 ࣪ ִֶָ☾.'

function allowed(plugin, ctx, entry = {}) {
  if (entry.owner && !ctx.isOwner && !ctx.isMod) return false
  if (plugin.owner && !ctx.isOwner && !(plugin.mod && ctx.isMod)) return false
  if (plugin.admin && !ctx.isOwner && !ctx.isMod && !ctx.isAdmin) return false
  return true
}

export function availablePlugins(ctx) {
  return ctx.registry.list.filter(plugin => allowed(plugin, ctx))
}

export function pluginsByCategory(ctx) {
  return MENU_LAYOUT.map(([id, definitions]) => {
    const entries = definitions.map(definition => {
      const entry = typeof definition === 'string' ? { command: definition } : definition
      const plugin = ctx.registry.get(entry.command)
      return plugin && allowed(plugin, ctx, entry) ? { ...entry, plugin } : null
    }).filter(Boolean)
    return { id, ...CATEGORIES[id], entries, plugins: entries.map(entry => entry.plugin) }
  }).filter(category => category.entries.length)
}

function cleanUsage(usage) {
  return String(usage || '').replace(/\s*\([^)]*\)/g, '').trim()
}

function entryExample(entry, prefix) {
  const display = entry.display || `${entry.command}${cleanUsage(entry.plugin.usage) ? ` ${cleanUsage(entry.plugin.usage)}` : ''}`
  return `> \`${prefix}${display}\``
}

export function commandExample(plugin, prefix) {
  return entryExample({ command: plugin.commands[0], plugin }, prefix)
}

function categoryHeader(category) {
  if (category.subcategory) {
    const subheader = `\`=>\` \`>\` \`$\` ${category.label} \`${category.parent}\``
    return category.parentHeader
      ? `\`✼ •• ┈┈ ⋯ ${category.parentHeader} ⋯ ┈┈ •• ✼\`\n${subheader}`
      : subheader
  }
  return `\`✼ •• ┈┈ ⋯ ${category.label} ⋯ ┈┈ •• ✼\``
}

export function buildCategoryText(category, prefix) {
  const entries = category.entries || category.plugins.map(plugin => ({ command: plugin.commands[0], plugin }))
  return `${categoryHeader(category)}\n${entries.map(entry => entryExample(entry, prefix)).join('\n')}`
}

export function buildCommandsText(ctx) {
  return `──── MENÚ COMPLETO ────\n\n${pluginsByCategory(ctx).map(category => buildCategoryText(category, ctx.usedPrefix)).join('\n\n')}`
}

export function buildMenuHeader(ctx) {
  const { config, m } = ctx
  const user = cleanNumber(m.senderDisplay) || m.name
  const owners = config.owners.map(owner => `> ${moon} ⊹ wa.me/${owner.number} ⊹ ${owner.name}`)
  const lids = config.ownerLids.map((lid, index) => `> ${moon} ⊹ LID ${lid} ⊹ Owner ${index + 1}`)
  const role = ctx.isOwner ? 'Propietario' : ctx.isMod ? 'Moderador' : ctx.isAdmin ? 'Administrador' : 'Usuario'
  const commandCount = pluginsByCategory(ctx).reduce((total, category) => total + category.entries.length, 0)

  return `${moon} BIENVENIDO/A @${user}\n\n   𓍯  INFO USUARIO  𓍯\n\n` +
    `> ${moon} ROL: ${role}\n> ${moon} BOT: ${config.botName}\n> ${moon} TIPO: Multi Device\n` +
    `> ${moon} TIEMPO ACTIVO: ${formatUptime(Date.now() - ctx.startedAt)}\n> ${moon} COMANDOS: ${commandCount}\n` +
    `> ${moon} MEMORIA: ${memoryUsage()}\n\n${moon} PROPIETARIOS ${moon}\n${[...owners, ...lids].join('\n')}`.trim()
}

export function buildFullMenu(ctx) {
  return `${buildMenuHeader(ctx)}\n\n${buildCommandsText(ctx)}`
}

export function buildMenuSections(ctx, native = false) {
  const rows = pluginsByCategory(ctx).map(category => ({
    ...(native ? { header: '', id: `${MENU_ROW_PREFIX}${category.id}` } : { rowId: `${MENU_ROW_PREFIX}${category.id}` }),
    title: category.label,
    description: `${category.description} · ${category.entries.length} comandos`,
  }))
  const sections = []
  for (let index = 0; index < rows.length; index += 10) {
    const page = Math.floor(index / 10) + 1
    sections.push({
      title: `${moon} CATEGORÍAS${page > 1 ? ` · ${page}` : ''}`,
      rows: rows.slice(index, index + 10),
    })
  }
  return sections
}

export function categoryFromSelection(selectionId = '') {
  return selectionId.startsWith(MENU_ROW_PREFIX) ? selectionId.slice(MENU_ROW_PREFIX.length) : ''
}

export function findCategory(ctx, value = '') {
  const wanted = normalizeCommand(value)
  const resolved = CATEGORY_ALIASES[wanted] || wanted
  return pluginsByCategory(ctx).find(category => normalizeCommand(category.id) === resolved || normalizeCommand(category.label) === wanted) || null
}

export function buildSelectedCategory(ctx, category) {
  return buildCategoryText(category, ctx.usedPrefix)
}
