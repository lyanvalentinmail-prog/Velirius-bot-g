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

test('carga los 135 comandos sin alias duplicados y con sus categorías', () => {
  assert.equal(registry.count, 135)
  assert.ok(registry.commands.size >= 250)
  for (const command of [
    'menu', 'play', 'tiktok', 'stt', 'bratvideo', 'attp', 'emojimix',
    'sticker', 'toimg', 'tovid', 'pack', 'quotly', 'googleimg', 'pokemoncard',
    'ship', 'gaycard', 'minions', 'hug', 'setprefix', 'kick',
  ]) {
    assert.ok(registry.get(command), `Falta ${command}`)
  }
  const expected = {
    anime: 4,
    downloader: 9,
    searcher: 5,
    tools: 6,
    reactions: 26,
    stickersmaker: 14,
    stickerseditor: 4,
    canvas: 19,
    effects: 16,
  }
  for (const [category, count] of Object.entries(expected)) {
    assert.equal(registry.list.filter(plugin => plugin.category === category).length, count, category)
  }
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
})
