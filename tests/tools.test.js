import test from 'node:test'
import assert from 'node:assert/strict'
import { PluginRegistry } from '../src/plugins.js'

const registry = await new PluginRegistry().load()

test('STT transcribe una URL con el idioma solicitado', async () => {
  const plugin = registry.get('stt')
  const calls = []
  const replies = []
  const ctx = {
    plugin,
    args: ['en', 'https://example.com/audio.ogg'],
    api: {
      async json(route, params, options) {
        calls.push({ route, params, options })
        return { text: 'Hello from Velirius', provider: 'prueba' }
      },
    },
    react: async () => {},
    reply: async text => replies.push(text),
  }
  await plugin.execute(ctx)
  assert.equal(calls[0].route, '/tools/stt')
  assert.deepEqual(calls[0].params, { url: 'https://example.com/audio.ogg', lang: 'en' })
  assert.equal(calls[0].options.timeoutMs, 120000)
  assert.match(replies[0], /Hello from Velirius/)
})
