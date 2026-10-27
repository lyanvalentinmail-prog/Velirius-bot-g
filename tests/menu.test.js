import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import {
  availablePlugins,
  CATEGORIES,
  buildFullMenu,
  buildMenuHeader,
  buildMenuSections,
  buildSelectedCategory,
  categoryFromSelection,
  findCategory,
  MENU_LAYOUT,
  MENU_ROW_PREFIX,
  pluginsByCategory,
} from '../src/menu.js'

const registry = await new PluginRegistry().load()
const context = {
  registry,
  config: structuredClone(DEFAULT_CONFIG),
  m: { senderDisplay: '59890000000@s.whatsapp.net', sender: '59890000000@s.whatsapp.net', name: 'Usuario' },
  isOwner: false,
  isMod: false,
  isAdmin: false,
  isGroup: false,
  startedAt: Date.now() - 65000,
  usedPrefix: '.',
}
const ownerContext = {
  ...context,
  m: { senderDisplay: '59896719709@s.whatsapp.net', sender: '59896719709@s.whatsapp.net', name: 'Lyann' },
  isOwner: true,
  isAdmin: true,
  isGroup: true,
}

test('carga 219 comandos, 397 alias y todas las entradas del menú', () => {
  assert.equal(registry.count, 219)
  assert.equal(registry.commands.size, 397)
  for (const command of [
    'menu', 'play', 'tiktok', 'stt', 'bratvideo', 'attp', 'emojimix', 'sticker', 'pack',
    'catch', 'w', 'claim', 'balance', 'perfil', 'mod', 'sban', 'warn', 'mute', 'fijar',
    'photogp', 'antilink', 'antipalabra', 'qr', 'code', 'bots', 'dado', 'adivinanza',
    'pescar', 'miner', 'ppt', 'ahorcado', 'prestamo', 'pagar', 'robar', 'setage', 'marry',
    'nota', 'delnota', 'reveal', 'topactivos', 'topinactivos', 'topgays', 'meme', 'sgay',
  ]) assert.ok(registry.get(command), `Falta ${command}`)
  for (const removed of ['waifu', 'neko', 'maid']) assert.equal(registry.get(removed), null)
  assert.equal(Object.keys(CATEGORIES).length, 18)
  for (const [category, entries] of MENU_LAYOUT) {
    assert.ok(CATEGORIES[category])
    for (const raw of entries) {
      const entry = typeof raw === 'string' ? { command: raw } : raw
      assert.ok(registry.get(entry.command), `${category}: ${entry.command} no está registrado`)
    }
  }
  for (const plugin of registry.list) {
    assert.ok(plugin.description.length > 0)
    assert.equal(typeof plugin.execute, 'function')
  }
})

test('el encabezado y el menú completo siguen el diseño solicitado', () => {
  const header = buildMenuHeader(ownerContext)
  const full = buildFullMenu(ownerContext)
  assert.match(header, /BIENVENIDO\/A @59896719709/)
  assert.match(header, /INFO USUARIO/)
  assert.match(header, /TIEMPO ACTIVO:/)
  assert.match(header, /wa.me\/59896719709 ⊹ Lyann/)
  assert.match(full, /──── MENÚ COMPLETO ────/)
  assert.match(full, /`✼ •• ┈┈ ⋯ General ⋯ ┈┈ •• ✼`/)
  assert.match(full, /`=>` `>` `\$` antis `Admins`/)
  assert.match(full, /`=>` `>` `\$` Pokemon `Juegos rpg`/)
  assert.match(full, /`✼ •• ┈┈ ⋯ stickers ⋯ ┈┈ •• ✼`/)
  assert.match(full, /> `\.brat\/bratv <texto>`/)
  assert.match(full, /> `\.pack <nombre.autor>`/)
  assert.ok(full.includes('> `.delwarn`\n'))
  assert.ok(full.includes('> `.fijar`\n'))
  assert.ok(full.includes('> `.perfil`\n'))
  for (const removed of ['.waifu', '.neko', '.maid']) assert.ok(!full.includes(removed))
  const categories = pluginsByCategory(ownerContext)
  assert.equal(categories.length, 18)
  assert.equal(categories.reduce((total, category) => total + category.entries.length, 0), 189)
})

test('el menú filtra comandos owner y admin para usuarios sin permisos', () => {
  const full = buildFullMenu(context)
  assert.ok(!availablePlugins(context).some(plugin => plugin.owner))
  assert.ok(!full.includes('.setprefix'))
  assert.ok(!full.includes('.mod @usuario'))
  assert.ok(!full.includes('.ban @usuario'))
  assert.ok(full.includes('.play <canción o artista>'))
  assert.ok(full.includes('.hug [@usuario]'))
})

test('la categoría seleccionada conserva entradas y no añade descripciones', () => {
  const category = findCategory(ownerContext, 'adicionales')
  const selected = buildSelectedCategory(ownerContext, category)
  const commandLines = selected.split('\n').filter(line => line.startsWith('> `'))
  assert.equal(commandLines.length, category.entries.length)
  assert.ok(!selected.includes('\n\n'))
  assert.ok(!selected.includes('Guarda una nota personal'))
  assert.ok(selected.includes('> `.nota <contenido>`'))
  assert.ok(selected.includes('> `.resize <imagen/sticker> 800x600`'))
})

test('las secciones nativas y los aliases de categoría funcionan', () => {
  const sections = buildMenuSections(ownerContext, true)
  assert.ok(sections.length >= 2)
  assert.ok(sections.every(section => section.rows.length > 0 && section.rows.length <= 10))
  for (const row of sections.flatMap(section => section.rows)) {
    assert.ok(row.id.startsWith(MENU_ROW_PREFIX))
    assert.ok(findCategory(ownerContext, categoryFromSelection(row.id)))
  }
  for (const alias of ['downloads', 'descargas', 'search', 'buscador', 'tootles', 'efectos']) {
    assert.ok(findCategory(ownerContext, alias), `Alias de categoría ausente: ${alias}`)
  }
  assert.equal(findCategory(ownerContext, 'reactions').id, 'reactions')
  assert.equal(findCategory(ownerContext, 'reacciones').id, 'reactions')
  assert.equal(findCategory(ownerContext, 'pokemon').id, 'pokemon')
  assert.equal(findCategory(ownerContext, 'economy').id, 'rpg')
  assert.equal(findCategory(ownerContext, 'characters').id, 'rpg')
  assert.equal(findCategory(ownerContext, 'profile').id, 'perfil')
  assert.equal(findCategory(ownerContext, 'rpg').id, 'rpg')
})
