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
  MENU_ROW_PREFIX,
} from '../src/menu.js'

const registry = await new PluginRegistry().load()
const context = {
  registry,
  config: structuredClone(DEFAULT_CONFIG),
  m: { senderDisplay: '59890000000@s.whatsapp.net', sender: '59890000000@s.whatsapp.net', name: 'Usuario' },
  isOwner: false,
  isAdmin: false,
  isGroup: false,
  startedAt: Date.now() - 65000,
  usedPrefix: '.',
}

test('carga los 166 comandos sin alias duplicados y con sus categorías', () => {
  assert.equal(registry.count, 166)
  assert.ok(registry.commands.size >= 250)
  for (const command of [
    'menu', 'play', 'tiktok', 'stt', 'bratvideo', 'attp', 'emojimix',
    'sticker', 'toimg', 'tovid', 'pack', 'quotly', 'googleimg', 'pokemoncard',
    'catch', 'pokedex', 'pokemonbattle', 'w', 'claim', 'harem', 'tiendag',
    'balance', 'daily', 'work', 'banco', 'setdesc', 'setbirth', 'perfil',
    'ship', 'gaycard', 'minions', 'hug', 'setprefix', 'kick',
  ]) {
    assert.ok(registry.get(command), `Falta ${command}`)
  }
  const expected = {
    anime: 29,
    pokemon: 3,
    gacha: 2,
    economia: 10,
    personajes: 8,
    perfil: 10,
    downloader: 9,
    searcher: 5,
    tools: 6,
    stickersmaker: 14,
    stickerseditor: 4,
    canvas: 19,
    effects: 16,
  }
  for (const [category, count] of Object.entries(expected)) {
    assert.equal(registry.list.filter(plugin => plugin.category === category).length, count, category)
  }
  assert.equal(registry.get('hug').category, 'anime')
  assert.equal(registry.get('catch').category, 'pokemon')
  assert.equal(registry.get('pokedex').category, 'pokemon')
  assert.equal(registry.get('pokemonbattle').category, 'pokemon')
  assert.equal(registry.get('w').category, 'gacha')
  assert.equal(registry.get('claim').category, 'gacha')
  assert.equal(registry.get('balance').category, 'economia')
  assert.equal(registry.get('harem').category, 'personajes')
  assert.equal(registry.get('perfil').category, 'perfil')
  assert.equal(Object.keys(CATEGORIES).length, 16)
  assert.equal(CATEGORIES.reactions, undefined)
  for (const plugin of registry.list) {
    assert.ok(plugin.description.length > 0)
    assert.ok(CATEGORIES[plugin.category], `Categoría desconocida: ${plugin.category}`)
    assert.equal(typeof plugin.execute, 'function')
  }
})

test('el menú conserva el estilo solicitado y filtra comandos owner', () => {
  const header = buildMenuHeader(context)
  const full = buildFullMenu(context)
  assert.match(header, /𝙱𝙸𝙴𝙽𝚅𝙴𝙽𝙸𝙳𝙾\/𝙰/)
  assert.match(header, /𝚃𝙸𝙴𝙼𝙿𝙾 𝙰𝙲𝚃𝙸𝚅𝙾/)
  assert.match(header, /wa.me\/59896719709/)
  assert.match(header, /\*Lyann\*/)
  assert.match(full, /\.play <canción o artista>/)
  assert.ok(!availablePlugins(context).some(plugin => plugin.owner))
  assert.ok(!full.includes('.setprefix'))
})

test('la categoría seleccionada sólo lista comandos y parámetros sin espacios extra', () => {
  const category = {
    ...CATEGORIES.tools,
    plugins: registry.list.filter(plugin => plugin.category === 'tools'),
  }
  const selected = buildSelectedCategory(context, category)
  const commandLines = selected.split('\n').filter(line => line.startsWith('> •'))
  assert.equal(commandLines.length, category.plugins.length)
  assert.ok(commandLines.every(line => !line.includes('(')))
  assert.ok(!selected.includes('\n\n'))
  assert.ok(!selected.includes('Escribe'))
  for (const plugin of category.plugins) {
    assert.ok(selected.includes(`.${plugin.commands[0]}`))
    assert.ok(!selected.includes(plugin.description))
  }
})

test('las secciones nativas generan selecciones y respetan el límite de filas', () => {
  const sections = buildMenuSections(context, true)
  assert.ok(sections.length >= 2)
  assert.ok(sections.every(section => section.rows.length > 0 && section.rows.length <= 10))
  for (const row of sections.flatMap(section => section.rows)) {
    assert.ok(row.id.startsWith(MENU_ROW_PREFIX))
    assert.ok(findCategory(context, categoryFromSelection(row.id)))
  }
  for (const alias of ['downloads', 'descargas', 'search', 'buscador', 'tootles', 'efectos']) {
    assert.ok(findCategory(context, alias), `Alias de categoría ausente: ${alias}`)
  }
  assert.equal(findCategory(context, 'reactions').id, 'anime')
  assert.equal(findCategory(context, 'reacciones').id, 'anime')
  assert.equal(findCategory(context, 'pokemon').id, 'pokemon')
  assert.equal(findCategory(context, 'economy').id, 'economia')
  assert.equal(findCategory(context, 'characters').id, 'personajes')
  assert.equal(findCategory(context, 'profile').id, 'perfil')
  assert.equal(findCategory(context, 'rpg').id, 'gacha')
})
