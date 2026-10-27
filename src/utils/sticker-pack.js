import {
  generateWAMessageContent as generateLiaMessageContent,
  getWAUploadToServer as getLiaUploadToServer,
  proto as liaProto,
} from '@itsliaaa/baileys'
import {
  generateMessageIDV2,
  proto as baileysProto,
} from '@whiskeysockets/baileys'

const MAX_PACK_STICKERS = 60
const silentLogger = {
  debug() {},
  error() {},
  info() {},
  trace() {},
  warn() {},
}

function packUploader(sock) {
  if (typeof sock.refreshMediaConn !== 'function') {
    throw new Error('La conexión de Baileys no permite obtener servidores de medios')
  }
  return getLiaUploadToServer({
    customUploadHosts: [],
    logger: sock.logger || silentLogger,
    options: {},
  }, force => sock.refreshMediaConn(force))
}

/**
 * Prepara el paquete con la fork que implementa StickerPackMessage y lo
 * transmite por la conexión principal, sin abrir una segunda sesión.
 */
export async function sendStickerPack(ctx, {
  name,
  publisher,
  description,
  stickers,
}, { upload } = {}) {
  if (!name?.trim() || !publisher?.trim()) {
    throw new Error('El paquete necesita un nombre y un autor')
  }
  if (!Array.isArray(stickers) || !stickers.length) {
    throw new Error('El paquete necesita al menos un sticker')
  }
  if (stickers.length > MAX_PACK_STICKERS) {
    throw new Error(`El paquete no puede superar ${MAX_PACK_STICKERS} stickers`)
  }
  if (typeof ctx.sock?.relayMessage !== 'function') {
    throw new Error('La conexión de Baileys no permite retransmitir el paquete')
  }

  const logger = ctx.sock.logger || silentLogger
  const generated = await generateLiaMessageContent({
    cover: stickers[0],
    stickers: stickers.map((data, index) => ({
      data,
      emojis: ['☾'],
      accessibilityLabel: `Sticker ${index + 1}`,
    })),
    name: name.trim(),
    publisher: publisher.trim(),
    description: description?.trim() || `${name.trim()} · ${publisher.trim()}`,
  }, {
    logger,
    mediaUploadTimeoutMs: 120000,
    options: {},
    upload: upload || packUploader(ctx.sock),
  })

  // Los dos proto incluyen StickerPackMessage. El paso binario evita que las
  // diferencias entre objetos planos y clases protobuf alteren el contenido.
  const message = baileysProto.Message.decode(
    liaProto.Message.encode(generated).finish(),
  )
  const messageId = generateMessageIDV2(ctx.sock.user?.id)
  await ctx.sock.relayMessage(ctx.m.chat, message, {
    messageId,
    additionalAttributes: {
      type: 'media',
      mediatype: 'sticker_pack',
    },
  })
  return { message, messageId }
}
