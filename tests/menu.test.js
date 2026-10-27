import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import {
  availablePlugins,
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

test('carga todos los comandos sin alias duplicados', () => {
  assert.ok(registry.count >= 80)
  assert.ok(registry.commands.size >= 150)
  for (const command of ['menu', 'play', 'tiktok', 'quotly', 'hug', 'setprefix', 'kick']) {
    assert.ok(registry.get(command), `Falta ${command}`)
  }
  for (const plugin of registry.list) {
    assert.ok(plugin.description.length > 0)
    assert.ok(plugin.category.length > 0)
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

test('las secciones nativas generan selecciones de categoría', () => {
  const sections = buildMenuSections(context, true)
  assert.ok(sections[0].rows.length >= 6)
  assert.ok(sections[0].rows.every(row => row.id.startsWith(MENU_ROW_PREFIX)))
  const selected = sections[0].rows[0].id
  const category = categoryFromSelection(selected)
  assert.ok(findCategory(context, category))
})
