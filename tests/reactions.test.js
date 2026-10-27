import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import reactionPlugins from '../plugins/reactions.js'
import { gifPlaybackPayload, gifToMp4, isGifMedia } from '../src/utils/gif.js'

const hugPlugin = reactionPlugins.find(plugin => plugin.commands[0] === 'hug')
const sender = '59811111111@s.whatsapp.net'
const target = '59822222222@s.whatsapp.net'

test('las reacciones convierten el GIF de la API y lo envían como GIF de WhatsApp', async () => {
  const gif = Buffer.from('GIF89a-contenido-de-prueba')
  const converted = Buffer.from('mp4-convertido')
  const sent = []
  const calls = []
  let convertedInput
  const ctx = {
    args: [],
    text: '',
    m: {
      sender,
      senderDisplay: sender,
      mentionedJid: [target],
      quoted: null,
    },
    react: async () => {},
    api: {
      media: async (route, params) => {
        calls.push({ route, params })
        return { buffer: gif, mimetype: 'image/gif' }
      },
    },
    gifToMp4: async input => {
      convertedInput = input
      return converted
    },
    send: async payload => sent.push(payload),
  }

  await hugPlugin.execute(ctx)
  assert.deepEqual(calls, [{ route: '/reactions/hug', params: { direct: 'true' } }])
  assert.equal(convertedInput, gif)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].video, converted)
  assert.equal(sent[0].mimetype, 'video/mp4')
  assert.equal(sent[0].gifPlayback, true)
  assert.match(sent[0].caption, /@59811111111 abraza a @59822222222/)
  assert.deepEqual(sent[0].contextInfo.mentionedJid, [sender, target])
})

test('gifPlaybackPayload conserva MP4 y convierte otros formatos animados', async () => {
  const mp4 = Buffer.from('mp4')
  let conversions = 0
  const convert = async buffer => {
    conversions += 1
    return Buffer.from(`convertido:${buffer}`)
  }
  const direct = await gifPlaybackPayload({ buffer: mp4, mimetype: 'video/mp4' }, convert)
  assert.equal(direct.video, mp4)
  assert.equal(direct.gifPlayback, true)
  assert.equal(conversions, 0)

  const gif = await gifPlaybackPayload({ buffer: Buffer.from('GIF89a'), mimetype: 'application/octet-stream' }, convert)
  assert.equal(gif.video.toString(), 'convertido:GIF89a')
  assert.equal(gif.mimetype, 'video/mp4')
  assert.equal(conversions, 1)
  assert.equal(isGifMedia({ buffer: Buffer.from('GIF89a') }), true)
})

test('gifToMp4 escribe una salida MP4 con parámetros compatibles', async () => {
  const input = Buffer.from('GIF89a')
  let command
  let args
  const output = await gifToMp4(input, 'image/gif', async (executable, parameters) => {
    command = executable
    args = parameters
    const inputFile = parameters[parameters.indexOf('-i') + 1]
    assert.deepEqual(await readFile(inputFile), input)
    await writeFile(parameters.at(-1), Buffer.from('MP4'))
  })
  assert.equal(command, 'ffmpeg')
  assert.equal(output.toString(), 'MP4')
  assert.ok(args.includes('libx264'))
  assert.ok(args.includes('+faststart'))
  assert.ok(args.some(value => String(value).includes('yuv420p')))
})
