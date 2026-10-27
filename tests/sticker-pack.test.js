import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import sharp from 'sharp'
import editorPlugins, { packSessions } from '../plugins/stickerseditor.js'
import { sendStickerPack } from '../src/utils/sticker-pack.js'

const packPlugin = editorPlugins.find(plugin => plugin.commands.includes('pack'))
const keyOf = ctx => `${ctx.m.chat}:${ctx.userKey}`

function makeContext(text = '', overrides = {}) {
  const replies = []
  const relays = []
  const ctx = {
    text,
    usedPrefix: '.',
    userKey: 'usuario',
    m: { chat: 'chat@g.us', sender: 'usuario@s.whatsapp.net' },
    reply: async message => replies.push(message),
    sock: {
      user: { id: 'bot@s.whatsapp.net' },
      relayMessage: async (...args) => relays.push(args),
    },
    ...overrides,
  }
  return { ctx, replies, relays }
}

afterEach(() => {
  for (const session of packSessions.values()) clearTimeout(session.timer)
  packSessions.clear()
})

test('pack inicia con nombre,autor, aísla usuarios y cancela', async () => {
  const { ctx, replies } = makeContext('Mi Pack,Lyann')
  await packPlugin.execute(ctx)
  const session = packSessions.get(keyOf(ctx))
  assert.equal(session.name, 'Mi Pack')
  assert.equal(session.author, 'Lyann')
  assert.deepEqual(session.stickers, [])
  assert.match(replies[0], /\.pack add.*\.pack done.*\.pack cancel/s)

  const other = makeContext('add', { userKey: 'otro-usuario' })
  await packPlugin.execute(other.ctx)
  assert.match(other.replies[0], /Primero inicia un paquete/)
  assert.equal(packSessions.has(keyOf(other.ctx)), false)

  ctx.text = 'Otro Pack,Otro Autor'
  await packPlugin.execute(ctx)
  assert.match(replies.at(-1), /Ya tienes un paquete en curso/)
  assert.equal(packSessions.get(keyOf(ctx)), session)

  ctx.text = 'cancel'
  await packPlugin.execute(ctx)
  assert.equal(packSessions.has(keyOf(ctx)), false)
  assert.match(replies.at(-1), /Paquete cancelado/)
})

test('pack también acepta nombre.autor como muestra el menú', async () => {
  const { ctx } = makeContext('Mi Pack.Lyann')
  await packPlugin.execute(ctx)
  const session = packSessions.get(keyOf(ctx))
  assert.equal(session.name, 'Mi Pack')
  assert.equal(session.author, 'Lyann')
})

test('pack add convierte fotos y pack done retransmite un StickerPackMessage', async () => {
  const input = await sharp({
    create: { width: 48, height: 36, channels: 4, background: { r: 35, g: 120, b: 220, alpha: 1 } },
  }).png().toBuffer()
  const uploads = []
  const { ctx, replies, relays } = makeContext('Recuerdos,Lyann', {
    downloadMedia: async () => ({ buffer: input, type: 'image' }),
    packUpload: async (filePath, { mediaType, fileEncSha256B64 }) => {
      assert.ok(statSync(filePath).size > 0)
      assert.ok(fileEncSha256B64)
      uploads.push(mediaType)
      return {
        directPath: `/media/${mediaType}`,
        mediaUrl: `https://media.example/${mediaType}`,
      }
    },
  })

  await packPlugin.execute(ctx)
  ctx.text = 'add'
  await packPlugin.execute(ctx)
  const session = packSessions.get(keyOf(ctx))
  assert.equal(session.stickers.length, 1)
  assert.equal(session.stickers[0].subarray(0, 4).toString(), 'RIFF')
  await packPlugin.execute(ctx)
  assert.equal(session.stickers.length, 2)
  assert.match(replies.at(-1), /2\/60/)

  ctx.text = 'done'
  await packPlugin.execute(ctx)
  assert.deepEqual(uploads, ['sticker-pack', 'thumbnail-sticker-pack'])
  assert.equal(relays.length, 1)
  const [jid, message, options] = relays[0]
  assert.equal(jid, ctx.m.chat)
  assert.equal(typeof options.messageId, 'string')
  assert.deepEqual(options.additionalAttributes, {
    type: 'media',
    mediatype: 'sticker_pack',
  })

  const pack = message.stickerPackMessage
  assert.ok(pack)
  assert.equal(pack.name, 'Recuerdos')
  assert.equal(pack.publisher, 'Lyann')
  assert.equal(pack.packDescription, 'Recuerdos · Lyann')
  assert.ok(pack.stickerPackId)
  assert.equal(pack.stickers.length, 2)
  assert.equal(pack.directPath, '/media/sticker-pack')
  assert.equal(pack.thumbnailDirectPath, '/media/thumbnail-sticker-pack')
  assert.ok(Number(pack.fileLength) > 0)
  assert.ok(Number(pack.stickerPackSize) > 0)
  assert.equal(packSessions.has(keyOf(ctx)), false)
})

test('el adaptador obtiene servidores de medios de la conexión principal', async () => {
  const sticker = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 80, g: 40, b: 160 } },
  }).webp().toBuffer()
  const { ctx, relays } = makeContext()
  let refreshes = 0
  ctx.sock.refreshMediaConn = async force => {
    assert.equal(force, false)
    refreshes += 1
    return { hosts: [], auth: 'auth', ttl: 3600, fetchDate: new Date() }
  }

  await assert.rejects(
    sendStickerPack(ctx, { name: 'Pack', publisher: 'Autor', stickers: [sticker] }),
    /Media upload failed on all hosts/,
  )
  assert.equal(refreshes, 1)
  assert.equal(relays.length, 0)
})

test('pack conserva la sesión si done falla y permite cancelar después', async () => {
  const input = await sharp({
    create: { width: 24, height: 24, channels: 3, background: { r: 200, g: 80, b: 30 } },
  }).jpeg().toBuffer()
  const { ctx } = makeContext('Reintento,Lyann', {
    downloadMedia: async () => ({ buffer: input, type: 'image' }),
  })
  await packPlugin.execute(ctx)
  ctx.text = 'add'
  await packPlugin.execute(ctx)
  const session = packSessions.get(keyOf(ctx))

  ctx.packUpload = async () => { throw new Error('Fallo de subida simulado') }
  ctx.text = 'done'
  await assert.rejects(packPlugin.execute(ctx), /Fallo de subida simulado/)
  assert.equal(packSessions.get(keyOf(ctx)), session)
  assert.equal(session.busy, false)
  assert.equal(session.stickers.length, 1)

  ctx.text = 'cancel'
  await packPlugin.execute(ctx)
  assert.equal(packSessions.has(keyOf(ctx)), false)
})

test('pack valida estados, formato y máximo de imágenes', async () => {
  const { ctx, replies } = makeContext('add')
  await packPlugin.execute(ctx)
  assert.match(replies.at(-1), /Primero inicia un paquete/)
  ctx.text = 'done'
  await packPlugin.execute(ctx)
  assert.match(replies.at(-1), /No tienes un paquete en curso/)
  ctx.text = 'Sin autor'
  await packPlugin.execute(ctx)
  assert.match(replies.at(-1), /nombre,autor/)
  assert.equal(packSessions.has(keyOf(ctx)), false)

  ctx.text = 'Pack,Autor'
  await packPlugin.execute(ctx)
  const session = packSessions.get(keyOf(ctx))
  ctx.text = 'done'
  await packPlugin.execute(ctx)
  assert.match(replies.at(-1), /al menos una foto/)

  session.stickers.push(...Array.from({ length: 60 }, () => Buffer.from('webp')))
  let downloads = 0
  ctx.downloadMedia = async () => { downloads += 1 }
  ctx.text = 'add'
  await packPlugin.execute(ctx)
  assert.equal(downloads, 0)
  assert.match(replies.at(-1), /máximo de 60/)
})
