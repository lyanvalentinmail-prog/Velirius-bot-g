import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import webp from 'node-webpmux'
import {
  imageToSticker,
  isAnimatedWebp,
  stickerPayload,
  stickerToImage,
} from '../src/utils/sticker.js'

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
  assert.ok(sticker.length <= 100 * 1024)
  const payload = stickerPayload(sticker)
  assert.equal(payload.sticker, sticker)
  assert.equal(payload.mimetype, 'image/webp')
  assert.equal(payload.width, 512)
  assert.equal(payload.height, 512)
  assert.equal(payload.isAnimated, false)
  const expectedExifHeader = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ])
  expectedExifHeader.writeUIntLE(image.exif.length - 22, 14, 4)
  assert.deepEqual(image.exif.subarray(0, 22), expectedExifHeader)
  assert.equal(image.exif.readUIntLE(14, 4), image.exif.length - 22)
  const metadata = JSON.parse(image.exif.subarray(22).toString('utf8'))
  assert.equal(metadata['sticker-pack-name'], 'Pack de prueba')
  assert.equal(metadata['sticker-pack-publisher'], 'Velirius')
  assert.ok(metadata['sticker-pack-id'])

  const png = await stickerToImage(sticker)
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
})

test('detecta el flag de animación WebP para el payload de Baileys', () => {
  const animated = Buffer.alloc(30)
  animated.write('RIFF', 0, 'ascii')
  animated.writeUInt32LE(22, 4)
  animated.write('WEBP', 8, 'ascii')
  animated.write('VP8X', 12, 'ascii')
  animated.writeUInt32LE(10, 16)
  animated[20] = 0x02
  assert.equal(isAnimatedWebp(animated), true)
  assert.equal(stickerPayload(animated).isAnimated, true)
})
