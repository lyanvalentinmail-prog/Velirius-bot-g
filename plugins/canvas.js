import {
  argsWithoutUrls,
  imageCanvasCommand,
  imageInput,
  parts,
  profileInput,
  requestWithImages,
  sendCanvas,
  textCanvasCommand,
  textOrQuoted,
  textWithoutUrls,
} from '../src/utils/canvas.js'
import { cleanNumber, isHttpUrl } from '../src/utils/format.js'
import { downloadMessageMedia, mediaPayload } from '../src/utils/media.js'
import { stickerToImage } from '../src/utils/sticker.js'

function pairCanvas(id, description) {
  return {
    commands: [id],
    category: 'canvas',
    description,
    usage: '<nombre 1> | <nombre 2> [|%] [|texto]',
    async execute(ctx) {
      const targets = ctx.m.mentionedJid || []
      const first = targets[0] || ctx.m.sender
      const second = targets[1] || ctx.m.quoted?.sender || ctx.m.sender
      const [rawName1, rawName2, percentage, ...rest] = parts(ctx.text)
      const name1 = rawName1 || cleanNumber(first)
      const name2 = rawName2 || cleanNumber(second)
      if (!name1 || !name2) {
        return ctx.reply(`☾ Uso: ${ctx.usedPrefix}${id} Luna | Sol | 95 | Mejores amigos`)
      }
      await ctx.react('🌙')
      const [image1, image2] = await Promise.all([
        profileInput(ctx, first),
        second ? profileInput(ctx, second) : null,
      ])
      return sendCanvas(ctx, id, {
        params: { name1, name2, percentage, text: rest.join(' | ') || undefined },
        sources: { image1, image2 },
      })
    },
  }
}

export default [
  {
    commands: ['quotly', 'qc'],
    category: 'canvas',
    description: 'Convierte texto en una cita con foto de perfil',
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}quotly <texto>`)
      await ctx.react('💬')
      const image = await imageInput(ctx, { profile: true })
      return sendCanvas(ctx, 'quotly', { params: { text }, sources: { image } })
    },
  },
  {
    commands: ['iqc'],
    category: 'canvas',
    description: 'Crea una cita estilo iMessage',
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}iqc <texto>`)
      await ctx.react('💬')
      const includeReply = Boolean(ctx.text && ctx.m.quoted?.text)
      return sendCanvas(ctx, 'iqc', {
        params: {
          text,
          ...(includeReply ? { replyText: ctx.m.quoted.text, replyName: 'Usuario' } : {}),
        },
      })
    },
  },
  textCanvasCommand({
    commands: ['iqcblue', 'iqcazul'],
    description: 'Crea una cita azul estilo iMessage',
  }),
  textCanvasCommand({
    commands: ['iqcpink', 'iqcrosa'],
    description: 'Crea una cita rosa estilo iMessage',
  }),
  textCanvasCommand({
    commands: ['messengerquote', 'messenger'],
    description: 'Crea una cita estilo Messenger',
  }),
  {
    commands: ['profilenote', 'notaperfil'],
    category: 'canvas',
    description: 'Crea una nota con tu foto de perfil',
    usage: '[texto de la nota]',
    async execute(ctx) {
      await ctx.react('🌙')
      const image = await imageInput(ctx, { profile: true })
      return sendCanvas(ctx, 'profilenote', {
        params: { text: ctx.text || 'Tu nota', label: ctx.text || 'Tu nota' },
        sources: { image },
      })
    },
  },
  {
    commands: ['pov'],
    category: 'canvas',
    description: 'Crea un meme POV con tu foto',
    usage: '<texto>',
    async execute(ctx) {
      const text = textOrQuoted(ctx)
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}pov <texto>`)
      await ctx.react('🎨')
      const source = await imageInput(ctx, { profile: true })
      return sendCanvas(ctx, 'pov', { params: { text }, sources: { image: source } })
    },
  },
  textCanvasCommand({
    commands: ['x', 'tweet'],
    description: 'Crea una publicación estilo X',
  }),
  {
    commands: ['cuentatiktok', 'tiktokaccount'],
    category: 'canvas',
    description: 'Crea un perfil falso de TikTok',
    usage: '[usuario] [|estado]',
    async execute(ctx) {
      await ctx.react('🎨')
      const [username, status] = parts(ctx.text)
      const source = await imageInput(ctx, { profile: true })
      return sendCanvas(ctx, 'cuentatiktok', {
        params: { username: username || ctx.m.name, status: status || undefined },
        sources: { image: source },
      })
    },
  },
  {
    commands: ['storyreply', 'historia'],
    category: 'canvas',
    description: 'Crea una respuesta a una historia',
    usage: '<texto> (respondiendo a una imagen o con URL)',
    async execute(ctx) {
      const text = textWithoutUrls(ctx) || ctx.m.quoted?.text
      if (!text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}storyreply <texto> (con imagen)`)
      const source = await imageInput(ctx, { required: true })
      await ctx.react('💬')
      return sendCanvas(ctx, 'storyreply', { params: { text }, sources: { url: source } })
    },
  },
  imageCanvasCommand({
    commands: ['canvaimagen', 'canva'],
    category: 'canvas',
    description: 'Convierte una imagen en un lienzo',
    usage: '[zoom] [URL] (o responde a una imagen)',
    params: (ctx, args) => ({ zoom: args[0] || undefined }),
  }),
  imageCanvasCommand({
    commands: ['laptop'],
    category: 'canvas',
    description: 'Coloca una imagen en una laptop',
    usage: '[zoom] [URL] (o responde a una imagen)',
    params: (ctx, args) => ({ zoom: args[0] || undefined }),
  }),
  imageCanvasCommand({
    commands: ['pc'],
    category: 'canvas',
    description: 'Coloca una imagen en un monitor de PC',
  }),
  {
    commands: ['googleimg', 'canvasgoogle'],
    category: 'canvas',
    description: 'Crea una búsqueda de Google con tu foto',
    usage: '(opcionalmente responde a una imagen)',
    async execute(ctx) {
      await ctx.react('🎨')
      const image = await imageInput(ctx, { profile: true })
      return sendCanvas(ctx, 'google', { sources: { url: image } })
    },
  },
  {
    commands: ['searched', 'buscado'],
    category: 'canvas',
    description: 'Crea un meme de búsqueda con una imagen',
    usage: '[nombre] [URL] (o responde a una imagen)',
    async execute(ctx) {
      const source = await imageInput(ctx, { required: true })
      await ctx.react('🎨')
      return sendCanvas(ctx, 'searched', {
        params: { name: textWithoutUrls(ctx) || ctx.m.name },
        sources: { url: source },
      })
    },
  },
  {
    commands: ['pokemoncard', 'cartapokemon'],
    category: 'canvas',
    description: 'Crea una carta Pokémon personalizada',
    usage: '<nombre>|<HP>|<ataque>|<daño>|<descripción> (con imagen)',
    async execute(ctx) {
      const source = await imageInput(ctx, { required: true })
      const [name, hp, attack, damage, ...description] = parts(textWithoutUrls(ctx))
      await ctx.react('🎨')
      return sendCanvas(ctx, 'pokemoncard', {
        params: {
          name: name || ctx.m.name,
          hp: hp || undefined,
          attack: attack || undefined,
          damage: damage || undefined,
          description: description.join(' | ') || undefined,
        },
        sources: { url: source },
      })
    },
  },
  pairCanvas('ship', 'Crea una carta de compatibilidad'),
  pairCanvas('friendship', 'Crea una carta de amistad'),
  {
    commands: ['gaycard'],
    category: 'canvas',
    description: 'Crea una Gay Card personalizada',
    usage: '[nombre] [|%] [URL] (o responde a una imagen)',
    async execute(ctx) {
      const source = await imageInput(ctx, { required: true })
      const [name, percentage] = parts(textWithoutUrls(ctx))
      await ctx.react('🎨')
      return sendCanvas(ctx, 'gaycard', {
        params: { name: name || ctx.m.name, percentage: percentage || undefined },
        sources: { url: source },
      })
    },
  },
  {
    commands: ['resize', 'rezize'],
    category: 'tools',
    description: 'Redimensiona una imagen con Sharp',
    usage: '[ancho] [alto] (respondiendo a una imagen)',
    async execute(ctx) {
      const args = argsWithoutUrls(ctx)
      const dimensions = args.find(arg => /^\d+x\d+$/i.test(arg))
      const numbers = dimensions ? dimensions.split(/x/i).map(Number) : []
      const width = dimensions ? numbers[0] : args[0] ? Number(args[0]) : 512
      const height = dimensions ? numbers[1] : args[1] ? Number(args[1]) : (args[0] ? undefined : 512)
      if ((width !== undefined && (!Number.isInteger(width) || width < 1 || width > 4096)) ||
          (height !== undefined && (!Number.isInteger(height) || height < 1 || height > 4096))) {
        return ctx.reply('☾ El ancho y el alto deben ser enteros entre 1 y 4096.')
      }
      let source
      const url = ctx.args.find(isHttpUrl)
      if (url) source = { url }
      else {
        const input = await downloadMessageMedia(ctx.m, { types: ['image', 'sticker'], maxBytes: 12 * 1024 * 1024 })
        if (!input) return ctx.reply(`☾ Responde a una imagen o sticker con *${ctx.usedPrefix}resize 800x600*.`)
        const buffer = input.type === 'sticker' ? await stickerToImage(input.buffer) : input.buffer
        const mimetype = input.type === 'sticker' ? 'image/png' : input.mimetype
        source = { data: `data:${mimetype};base64,${buffer.toString('base64')}`, mimetype }
      }
      await ctx.react('🌙')
      const media = await requestWithImages(ctx, '/tools/resize', {
        params: { width, height, format: 'png' },
        sources: { url: source },
      })
      await ctx.send(mediaPayload(media, 'image'))
    },
  },
]
