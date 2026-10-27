import test from 'node:test'
import assert from 'node:assert/strict'
import { bannerMedia, sendViaLia } from '../src/interactive.js'

function mockSocket() {
  const sent = []
  return {
    sent,
    user: { id: '59896719709@s.whatsapp.net', jid: '59896719709@s.whatsapp.net' },
    waUploadToServer: async () => ({ mediaUrl: 'https://example.invalid/media', directPath: '/media' }),
    relayMessage: async (jid, message, options) => sent.push({ jid, message, options }),
  }
}

test('genera menú nativeFlow con banner y nodo biz', async () => {
  const sock = mockSocket()
  const media = await bannerMedia('./assets/banner.jpg')
  await sendViaLia(sock, '123@s.whatsapp.net', {
    ...media,
    caption: 'Velirius',
    footer: 'Bot',
    nativeFlow: [{
      text: 'Ver comandos',
      sections: [{ title: 'Categorías', rows: [{ header: '', title: 'General', description: 'Menú', id: 'vlrs_menu_general' }] }],
    }],
  })
  assert.ok(sock.sent[0].message.interactiveMessage)
  assert.equal(sock.sent[0].options.additionalNodes[0].tag, 'biz')
  assert.ok(sock.sent[0].message.interactiveMessage.header.imageMessage)
})

test('genera listMessage clásico con nodo biz', async () => {
  const sock = mockSocket()
  await sendViaLia(sock, '123@s.whatsapp.net', {
    title: 'Velirius',
    text: 'Menú',
    buttonText: 'Ver',
    sections: [{ title: 'Categorías', rows: [{ title: 'General', description: 'Menú', rowId: 'vlrs_menu_general' }] }],
  })
  assert.ok(sock.sent[0].message.listMessage)
  assert.equal(sock.sent[0].message.listMessage.sections[0].rows[0].rowId, 'vlrs_menu_general')
  assert.equal(sock.sent[0].options.additionalNodes[0].tag, 'biz')
})
