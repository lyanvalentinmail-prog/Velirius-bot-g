import test from 'node:test'
import assert from 'node:assert/strict'
import { PluginRegistry } from '../src/plugins.js'
import { requestWithImages } from '../src/utils/canvas.js'

const registry = await new PluginRegistry().load()

test('las imágenes locales viajan en POST y las URLs remotas en query', async () => {
  const calls = []
  const ctx = {
    api: {
      async media(route, params, options) {
        calls.push({ route, params, options })
        return { buffer: Buffer.from('ok'), mimetype: 'image/png' }
      },
    },
  }
  const data = 'data:image/png;base64,aW1hZ2Vu'
  await requestWithImages(ctx, '/canvas/prueba', {
    params: { text: 'Hola' },
    sources: { url: { data }, url2: { url: 'https://example.com/dos.jpg' } },
  })
  assert.equal(calls[0].route, '/canvas/prueba')
  assert.equal(calls[0].params.text, 'Hola')
  assert.equal(calls[0].params.url2, 'https://example.com/dos.jpg')
  assert.equal(calls[0].params.url, undefined)
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(calls[0].options.body, { url: data })

  await requestWithImages(ctx, '/canvas/prueba', {
    sources: { url: { url: 'https://example.com/uno.jpg' } },
  })
  assert.equal(calls[1].options.method, 'GET')
  assert.equal(calls[1].options.body, undefined)
})

test('los canvas de perfil usan los campos exigidos por Velirius', async () => {
  const cases = [
    ['profilenote', 'Mi nota', 'image', { text: 'Mi nota', label: 'Mi nota' }],
    ['pov', 'Cuando funciona', 'image', { text: 'Cuando funciona' }],
    ['cuentatiktok', 'velirius | En línea', 'image', { username: 'velirius', status: 'En línea' }],
    ['googleimg', '', 'url', {}],
  ]
  for (const [command, text, imageField, expected] of cases) {
    const plugin = registry.get(command)
    const calls = []
    const ctx = {
      plugin,
      command,
      text,
      args: text ? text.split(' ') : [],
      m: { sender: 'usuario@s.whatsapp.net', name: 'Usuario', message: null, quoted: null },
      sock: { profilePictureUrl: async () => 'https://example.com/perfil.jpg' },
      api: {
        async media(route, params, options) {
          calls.push({ route, params, options })
          return { buffer: Buffer.from('imagen'), mimetype: 'image/png' }
        },
      },
      react: async () => {},
      send: async () => {},
      reply: async () => { throw new Error(`No debía pedir texto: ${command}`) },
    }
    await plugin.execute(ctx)
    assert.equal(calls[0].route, `/canvas/${command === 'googleimg' ? 'google' : command}`)
    assert.equal(calls[0].params[imageField], 'https://example.com/perfil.jpg')
    for (const [key, value] of Object.entries(expected)) assert.equal(calls[0].params[key], value)
  }
})

test('un efecto conserva sus parámetros y devuelve una imagen', async () => {
  const plugin = registry.get('grayscale')
  const calls = []
  const sent = []
  const ctx = {
    plugin,
    command: 'grayscale',
    usedPrefix: '.',
    args: ['75', 'sepia', 'https://example.com/foto.jpg'],
    text: '75 sepia https://example.com/foto.jpg',
    api: {
      async media(route, params, options) {
        calls.push({ route, params, options })
        return { buffer: Buffer.from('imagen'), mimetype: 'image/png' }
      },
    },
    react: async () => {},
    send: async payload => sent.push(payload),
  }
  await plugin.execute(ctx)
  assert.equal(calls[0].route, '/canvas/grayscale')
  assert.deepEqual(calls[0].params, {
    amount: '75',
    tone: 'sepia',
    url: 'https://example.com/foto.jpg',
  })
  assert.equal(sent.length, 1)
  assert.ok(Buffer.isBuffer(sent[0].image))
})
