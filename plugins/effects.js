import { argsWithoutUrls, imageCanvasCommand, imageInput, sendCanvas } from '../src/utils/canvas.js'
import { isHttpUrl } from '../src/utils/format.js'

const definitions = [
  {
    commands: ['gay'],
    description: 'Aplica una bandera sobre una imagen',
    usage: '[opacidad] [URL] (o responde a una imagen)',
    params: (ctx, args) => ({ opacity: args[0] || undefined }),
  },
  { commands: ['invert', 'invertir'], description: 'Invierte los colores de una imagen' },
  {
    commands: ['grayscale', 'greyscale', 'bn'],
    description: 'Convierte una imagen a escala de grises',
    usage: '[intensidad] [tono] [URL]',
    params: (ctx, args) => ({ amount: args[0] || undefined, tone: args[1] || undefined }),
  },
  {
    commands: ['blur', 'desenfoque'],
    description: 'Desenfoca una imagen',
    usage: '[intensidad] [tinte] [URL]',
    params: (ctx, args) => ({ amount: args[0] || undefined, tint: args[1] || undefined }),
  },
  {
    commands: ['pixel', 'pixelate'],
    description: 'Pixela una imagen',
    usage: '[tamaño] [colores] [URL]',
    params: (ctx, args) => ({ size: args[0] || undefined, colors: args[1] || undefined }),
  },
  {
    commands: ['deepfry'],
    description: 'Aplica un efecto DeepFry',
    usage: '[intensidad] [ruido] [URL]',
    params: (ctx, args) => ({ amount: args[0] || undefined, noise: args[1] || undefined }),
  },
  {
    commands: ['sketch', 'boceto'],
    description: 'Convierte una imagen en un boceto',
    usage: '[intensidad] [detalle] [papel] [URL]',
    params: (ctx, args) => ({
      amount: args[0] || undefined,
      detail: args[1] || undefined,
      paper: args[2] || undefined,
    }),
  },
  {
    commands: ['swirl', 'remolino'],
    description: 'Deforma una imagen en espiral',
    usage: '[intensidad] [radio] [cx] [cy] [URL]',
    params: (ctx, args) => ({
      amount: args[0] || undefined,
      radius: args[1] || undefined,
      cx: args[2] || undefined,
      cy: args[3] || undefined,
    }),
  },
  {
    commands: ['liquify', 'licuar'],
    description: 'Licúa o estira una imagen',
    usage: '[intensidad] [modo] [radio] [cx] [cy] [URL]',
    params: (ctx, args) => ({
      amount: args[0] || undefined,
      mode: args[1] || undefined,
      radius: args[2] || undefined,
      cx: args[3] || undefined,
      cy: args[4] || undefined,
    }),
  },
  {
    commands: ['glitch'],
    description: 'Aplica un efecto glitch',
    usage: '[intensidad] [cortes] [semilla] [scanlines] [URL]',
    params: (ctx, args) => ({
      amount: args[0] || undefined,
      slices: args[1] || undefined,
      seed: args[2] || undefined,
      scanlines: args[3] || undefined,
    }),
  },
  ...['rata', 'banana', 'arandano', 'pan', 'galletita'].map(id => ({
    commands: [id],
    description: `Convierte una imagen en ${id}`,
    usage: '[zoom] [URL] (o responde a una imagen)',
    params: (ctx, args) => ({ zoom: args[0] || undefined }),
  })),
]

export default [
  ...definitions.map(definition => imageCanvasCommand({
    ...definition,
    id: definition.commands[0],
    category: 'effects',
  })),
  {
    commands: ['minions'],
    category: 'effects',
    description: 'Convierte una o varias imágenes en Minions',
    usage: '[zoom] [URL 2] [URL 3] (o responde a una imagen)',
    async execute(ctx) {
      const source = await imageInput(ctx, { required: true })
      const urls = ctx.args.filter(isHttpUrl)
      await ctx.react('🎨')
      return sendCanvas(ctx, 'minions', {
        params: { zoom: argsWithoutUrls(ctx)[0] || undefined },
        sources: {
          url: source,
          url2: urls[1] ? { url: urls[1] } : null,
          url3: urls[2] ? { url: urls[2] } : null,
        },
      })
    },
  },
]
