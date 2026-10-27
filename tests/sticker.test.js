import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import webp from 'node-webpmux'
import { PluginRegistry } from '../src/plugins.js'
import { imageToSticker, packFor, stickerToImage } from '../src/utils/sticker.js'

const registry = await new PluginRegistry().load()

test('crea stickers WebP de 512×512 con metadata y extrae PNG', async () => {
  const input = await sharp({
    create: { width: 32, height: 20, channels: 4, background: { r: 230, g: 40, b: 80, alpha: 1 } },
  }).png().toBuffer()
  const sticker = await imageToSticker(input, { packName: 'Pack de prueba', packAuthor: 'Velirius' })
  assert.equal(sticker.subarray(0, 4).toString(), 'RIFF')
  assert.equal(sticker.subarray(8, 12).toString(), 'WEBP')

  const image = new webp.Image()
  await image.load(sticker)
  assert.equal(image.width, 512)
  assert.equal(image.height, 512)
  const metadata = JSON.parse(image.exif.subarray(22).toString('utf8'))
  assert.equal(metadata['sticker-pack-name'], 'Pack de prueba')
  assert.equal(metadata['sticker-pack-publisher'], 'Velirius')
  assert.ok(metadata['sticker-pack-id'])

  const png = await stickerToImage(sticker)
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
})

test('guarda y restablece el pack y autor por usuario', async () => {
  const plugin = registry.get('pack')
  const user = {}
  let saves = 0
  const replies = []
  const ctx = {
    plugin,
    userKey: 'usuario',
    text: 'Mi Pack | Lyann',
    config: { botName: 'Velirius Bot' },
    m: { name: 'Usuario' },
    db: {
      data: { users: { usuario: user } },
      scheduleSave: () => { saves += 1 },
    },
    reply: async text => replies.push(text),
  }
  await plugin.execute(ctx)
  assert.equal(user.packname, 'Mi Pack')
  assert.equal(user.author, 'Lyann')
  assert.equal(saves, 1)
  assert.deepEqual(packFor(ctx), { packName: 'Mi Pack', packAuthor: 'Lyann', emojis: ['☾'] })
  assert.match(replies[0], /Metadata actualizada/)

  ctx.text = 'reset'
  await plugin.execute(ctx)
  assert.equal(user.packname, undefined)
  assert.equal(user.author, undefined)
  assert.equal(packFor(ctx).packName, 'Velirius Bot')
})
