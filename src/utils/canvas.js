import { isHttpUrl } from './format.js'
import { downloadMessageMedia, mediaPayload } from './media.js'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

export function textOrQuoted(ctx) {
  return String(ctx.text || ctx.m.quoted?.text || '').trim()
}

export function argsWithoutUrls(ctx) {
  return ctx.args.filter(arg => !isHttpUrl(arg))
}

export function textWithoutUrls(ctx) {
  return argsWithoutUrls(ctx).join(' ').trim()
}

export function parts(value = '') {
  return String(value).split('|').map(part => part.trim())
}

export async function profileInput(ctx, jid) {
  if (!jid) return null
  const url = await ctx.sock.profilePictureUrl(jid, 'image').catch(() => '')
  return url ? { url } : null
}

export async function imageInput(ctx, {
  required = false,
  profile = false,
  target = null,
} = {}) {
  const url = ctx.args.find(isHttpUrl)
  if (url) return { url }

  const media = await downloadMessageMedia(ctx.m, {
    types: ['image'],
    maxBytes: MAX_IMAGE_BYTES,
  })
  if (media) {
    const mimetype = (media.mimetype || 'image/jpeg').split(';')[0].replace('image/jpg', 'image/jpeg')
    return {
      data: `data:${mimetype};base64,${media.buffer.toString('base64')}`,
      mimetype,
    }
  }

  if (profile) {
    const source = await profileInput(ctx, target || ctx.m.quoted?.sender || ctx.m.sender)
    if (source) return source
  }
  if (required) throw new Error('Responde a una imagen o indica una URL pública de imagen.')
  return null
}

export async function requestWithImages(ctx, route, {
  params = {},
  sources = {},
} = {}) {
  const query = { ...params }
  const body = {}

  for (const [field, source] of Object.entries(sources)) {
    if (!source) continue
    if (source.url) query[field] = source.url
    else if (source.data) body[field] = source.data
  }

  const hasBody = Object.keys(body).length > 0
  return ctx.api.media(route, query, {
    method: hasBody ? 'POST' : 'GET',
    ...(hasBody ? { body } : {}),
  })
}

export async function sendCanvas(ctx, id, {
  params = {},
  sources = {},
  kind = 'image',
  caption = '',
} = {}) {
  const media = await requestWithImages(ctx, `/canvas/${id}`, { params, sources })
  await ctx.send(mediaPayload(media, kind, caption))
  return media
}

export function textCanvasCommand({
  commands,
  category = 'canvas',
  id = commands[0],
  description,
  usage = '<texto>',
  kind = 'image',
  params = null,
}) {
  return {
    commands,
    category,
    description,
    usage,
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}${commands[0]} ${usage}`)
      await ctx.react('🎨')
      const extra = typeof params === 'function' ? await params(ctx, text) : {}
      return sendCanvas(ctx, id, { params: { text, ...extra }, kind })
    },
  }
}

export function imageCanvasCommand({
  commands,
  category = 'effects',
  id = commands[0],
  description,
  usage = '[URL] (o responde a una imagen)',
  params = null,
}) {
  return {
    commands,
    category,
    description,
    usage,
    async execute(ctx) {
      const source = await imageInput(ctx, { required: true })
      const args = argsWithoutUrls(ctx)
      const extra = typeof params === 'function' ? await params(ctx, args) : {}
      await ctx.react('🎨')
      return sendCanvas(ctx, id, {
        params: extra,
        sources: { url: source },
      })
    },
  }
}
