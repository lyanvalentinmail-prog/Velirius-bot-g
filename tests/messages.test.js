import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../src/config.js'
import {
  extractSelectionId,
  extractText,
  parseCommandText,
  serializeMessage,
  unwrapMessage,
} from '../src/utils/messages.js'

test('parseCommandText normaliza acentos, argumentos y prefijos', () => {
  assert.deepEqual(parseCommandText('  .MENÚ descargas ahora  ', '.'), {
    command: 'menu',
    args: ['descargas', 'ahora'],
    text: 'descargas ahora',
    usedPrefix: '.',
  })
  assert.equal(parseCommandText('!!play artista canción', '!!').command, 'play')
  assert.equal(parseCommandText('menu', '.'), null)
  assert.equal(parseCommandText('.', '.'), null)
})

test('extrae respuestas de listas clásicas y nativeFlow', () => {
  const legacy = { listResponseMessage: { singleSelectReply: { selectedRowId: 'vlrs_menu_anime' } } }
  const native = {
    interactiveResponseMessage: {
      nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: 'vlrs_menu_canvas' }) },
    },
  }
  assert.equal(extractSelectionId(legacy), 'vlrs_menu_anime')
  assert.equal(extractSelectionId(native), 'vlrs_menu_canvas')
  assert.equal(extractText(legacy), 'vlrs_menu_anime')
})

test('desenvuelve mensajes efímeros y de una sola vista', () => {
  const wrapped = { ephemeralMessage: { message: { viewOnceMessage: { message: { conversation: 'Hola' } } } } }
  assert.deepEqual(unwrapMessage(wrapped), { conversation: 'Hola' })
  assert.equal(extractText(wrapped), 'Hola')
})

test('serializa LID/PN, owners, menciones y mensajes citados', async () => {
  const raw = {
    key: {
      remoteJid: '123@g.us',
      participant: '98765432109876@lid',
      participantAlt: '59896719709@s.whatsapp.net',
      id: 'ABC',
    },
    pushName: 'Lyann',
    message: {
      extendedTextMessage: {
        text: '.menu',
        contextInfo: {
          mentionedJid: ['111@s.whatsapp.net'],
          stanzaId: 'OLD',
          participant: '111@s.whatsapp.net',
          quotedMessage: { conversation: 'Mensaje anterior' },
        },
      },
    },
  }
  const m = await serializeMessage({}, raw, DEFAULT_CONFIG)
  assert.equal(m.isOwner, true)
  assert.equal(m.sender, '98765432109876@lid')
  assert.equal(m.senderDisplay, '59896719709@s.whatsapp.net')
  assert.equal(m.quoted.text, 'Mensaje anterior')
  assert.deepEqual(m.mentionedJid, ['111@s.whatsapp.net'])
  assert.equal(parseCommandText(m.text, '.').command, 'menu')
})
