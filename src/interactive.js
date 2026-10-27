import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isHttpUrl } from './utils/format.js'
import {
  buildCommandsText,
  buildFullMenu,
  buildMenuHeader,
  buildMenuSections,
} from './menu.js'

let liaPromise

async function loadLia() {
  liaPromise ||= Promise.all([
    import('@itsliaaa/baileys'),
    import('@itsliaaa/baileys/lib/WABinary/generic-utils.js'),
  ])
  return liaPromise
}

export async function sendViaLia(sock, jid, content, options = {}) {
  const [lia, { getBizBinaryNode }] = await loadLia()
  const message = await lia.generateWAMessage(jid, content, {
    userJid: sock.user?.jid || sock.user?.id,
    upload: sock.waUploadToServer,
    quoted: options.quoted,
    logger: options.logger,
  })
  const normalized = lia.normalizeMessageContent(message.message) || message.message
  const relayOptions = { messageId: message.key.id }

  if (lia.shouldIncludeBizBinaryNode(normalized)) {
    relayOptions.additionalNodes = [getBizBinaryNode(normalized)]
  }

  await sock.relayMessage(jid, message.message, relayOptions)
  return message
}

export async function bannerMedia(banner) {
  if (isHttpUrl(banner)) return { image: { url: banner } }
  const file = path.resolve(banner)
  return { image: await readFile(file), mimetype: 'image/jpeg' }
}

async function sendNativeMenu(ctx, withBanner = true) {
  const { sock, m, config } = ctx
  const media = withBanner ? await bannerMedia(config.banner) : {}
  const content = {
    ...media,
    ...(withBanner
      ? { caption: buildMenuHeader(ctx) }
      : { text: buildMenuHeader(ctx) }),
    footer: config.footer,
    nativeFlow: [{
      text: '☾ 𝚅𝙴𝚁 𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂',
      sections: buildMenuSections(ctx, true),
      icon: 'default',
    }],
    contextInfo: { mentionedJid: [m.sender] },
  }
  return sendViaLia(sock, m.chat, content, { quoted: m.raw })
}

async function sendLegacyMenu(ctx) {
  const { sock, m, config } = ctx
  return sendViaLia(sock, m.chat, {
    title: config.botName,
    text: buildMenuHeader(ctx),
    footer: config.footer,
    buttonText: '☾ 𝚅𝙴𝚁 𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂',
    sections: buildMenuSections(ctx, false),
    contextInfo: { mentionedJid: [m.sender] },
  }, { quoted: m.raw })
}

async function sendTextMenu(ctx) {
  const { sock, m, config } = ctx
  try {
    const media = await bannerMedia(config.banner)
    await sock.sendMessage(m.chat, {
      ...media,
      caption: buildMenuHeader(ctx),
      contextInfo: { mentionedJid: [m.sender] },
    }, { quoted: m.raw })
    return sock.sendMessage(m.chat, { text: buildCommandsText(ctx) }, { quoted: m.raw })
  } catch (error) {
    console.warn(`⚠ No se pudo enviar el banner: ${error.message}`)
    return sock.sendMessage(m.chat, {
      text: buildFullMenu(ctx),
      contextInfo: { mentionedJid: [m.sender] },
    }, { quoted: m.raw })
  }
}

export async function deliverMenu(ctx) {
  if (ctx.config.menuMode === 'interactive') {
    try {
      return await sendNativeMenu(ctx, true)
    } catch (error) {
      console.warn(`⚠ Menú interactivo con banner falló: ${error.message}`)
      try {
        return await sendNativeMenu(ctx, false)
      } catch (secondError) {
        console.warn(`⚠ Menú interactivo falló: ${secondError.message}`)
      }
    }
  }

  if (ctx.config.menuMode !== 'text') {
    try {
      return await sendLegacyMenu(ctx)
    } catch (error) {
      console.warn(`⚠ Lista clásica falló: ${error.message}`)
    }
  }

  return sendTextMenu(ctx)
}
