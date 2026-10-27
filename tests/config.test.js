import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConfigStore, DEFAULT_CONFIG, normalizeConfig } from '../src/config.js'

test('normaliza configuración y conserva owner Lyann', () => {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, prefix: '!', language: 'pt', mods: ['59822222222'], api: { baseUrl: 'https://example.com/' } })
  assert.equal(config.prefix, '!')
  assert.equal(config.language, 'pt')
  assert.deepEqual(config.mods, ['59822222222'])
  assert.equal(config.api.baseUrl, 'https://example.com')
  assert.equal(config.owners[0].name, 'Lyann')
  assert.equal(config.api.timeoutMs, DEFAULT_CONFIG.api.timeoutMs)
})

test('rechaza configuraciones inseguras o inválidas', () => {
  assert.throws(() => normalizeConfig({ ...DEFAULT_CONFIG, prefix: 'con espacio' }), /prefix/)
  assert.throws(() => normalizeConfig({ ...DEFAULT_CONFIG, owners: [], ownerLids: [] }), /al menos un owner/)
  assert.throws(() => normalizeConfig({ ...DEFAULT_CONFIG, api: { baseUrl: 'file:///tmp/config' } }), /HTTP o HTTPS/)
  assert.throws(() => normalizeConfig({ ...DEFAULT_CONFIG, menuMode: 'otro' }), /menuMode/)
  assert.throws(() => normalizeConfig({ ...DEFAULT_CONFIG, language: 'xx' }), /language/)
})

test('guarda cambios de forma persistente y atómica', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'velirius-config-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'config.json')
  await writeFile(file, JSON.stringify(DEFAULT_CONFIG))
  const store = new ConfigStore(file)
  await store.init({ watch: false })
  t.after(() => store.close())
  await store.update(config => {
    config.prefix = '#'
    config.botName = 'BOT TEST'
    config.owners.push({ number: '59891234567', name: 'Prueba' })
  })
  const saved = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(saved.prefix, '#')
  assert.equal(saved.botName, 'BOT TEST')
  assert.equal(saved.owners.length, 2)
  assert.equal(store.data.owners[1].name, 'Prueba')
})
