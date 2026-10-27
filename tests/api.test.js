import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { ApiError, MediaTooLargeError, VeliriusAPI } from '../src/api.js'

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/ok')) {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ status: true, result: { value: 42, query: req.url } }))
  }
  if (req.url === '/fail') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ status: false, error: 'Fallo de prueba' }))
  }
  if (req.url === '/media') {
    res.setHeader('content-type', 'image/png')
    res.setHeader('content-disposition', 'inline; filename="test.png"')
    return res.end(Buffer.from([1, 2, 3, 4]))
  }
  if (req.url === '/large') {
    res.setHeader('content-type', 'video/mp4')
    res.setHeader('content-length', '100')
    return res.end(Buffer.alloc(100))
  }
  res.statusCode = 404
  res.end()
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const baseUrl = `http://127.0.0.1:${server.address().port}`
const api = new VeliriusAPI({ baseUrl, timeoutMs: 2000, maxMediaMB: 1 })

test('construye URLs codificadas y desenvuelve resultados', async () => {
  const url = api.url('/searcher/google', { query: 'hola mundo', limit: 5 })
  assert.match(url, /query=hola\+mundo/)
  assert.match(url, /limit=5/)
  const result = await api.json('/ok', { query: 'velirius' })
  assert.equal(result.value, 42)
})

test('convierte errores de la API en ApiError', async () => {
  await assert.rejects(() => api.json('/fail'), error => {
    assert.ok(error instanceof ApiError)
    assert.match(error.message, /Fallo de prueba/)
    return true
  })
})

test('lee archivos multimedia y aplica límite de memoria', async t => {
  const media = await api.media('/media')
  assert.equal(media.buffer.length, 4)
  assert.equal(media.mimetype, 'image/png')
  assert.equal(media.filename, 'test.png')

  const small = new VeliriusAPI({ baseUrl, maxMediaMB: 0.00001 })
  await assert.rejects(() => small.media('/large'), MediaTooLargeError)
  t.after(() => server.close())
})
