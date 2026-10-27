import { cleanNumber } from '../src/utils/format.js'
import { gifPlaybackPayload } from '../src/utils/gif.js'
import { requestedTargets } from '../src/utils/group.js'

const definitions = [
  ['hug', ['abrazo'], 'abraza a', '🤗', 'Envía un GIF de abrazo.'],
  ['kiss', ['beso'], 'besa a', '😘', 'Envía un GIF de beso.'],
  ['pat', ['acariciar'], 'acaricia a', '🫳', 'Envía una caricia en la cabeza.'],
  ['slap', ['cachetada'], 'abofetea a', '👋', 'Envía una bofetada de broma.'],
  ['cuddle', ['acurrucar'], 'se acurruca con', '🥰', 'Envía un GIF para acurrucarse.'],
  ['wave', ['saludar'], 'saluda a', '👋', 'Envía un saludo animado.'],
  ['wink', ['guinar'], 'guiña a', '😉', 'Envía un guiño animado.'],
  ['blush', ['sonrojo'], 'se sonroja por', '☺️', 'Envía un GIF de sonrojo.'],
  ['smile', ['sonreir'], 'sonríe a', '😊', 'Envía una sonrisa animada.'],
  ['happy', ['feliz'], 'celebra con', '🥳', 'Envía un GIF de felicidad.'],
  ['dance', ['bailar'], 'baila con', '💃', 'Envía un GIF de baile.'],
  ['cry', ['llorar'], 'llora por', '😭', 'Envía un GIF de llanto.'],
  ['poke', ['tocar'], 'toca a', '👉', 'Envía un toque con el dedo.'],
  ['tickle', ['cosquillas'], 'hace cosquillas a', '🤣', 'Envía un GIF de cosquillas.'],
  ['highfive', ['chocar'], 'choca los cinco con', '🙏', 'Envía un GIF para chocar los cinco.'],
  ['handhold', ['tomarmano'], 'toma la mano de', '🤝', 'Envía un GIF tomados de la mano.'],
  ['nom', ['comer'], 'comparte un bocado con', '😋', 'Envía un GIF comiendo.'],
  ['bite', ['morder'], 'muerde a', '😬', 'Envía un mordisco de broma.'],
  ['bonk', [], 'golpea suavemente a', '🔨', 'Envía un GIF de bonk.'],
  ['baka', [], 'dice baka a', '😤', 'Envía un GIF de baka.'],
  ['smug', [], 'presume ante', '😏', 'Envía una cara de suficiencia.'],
  ['laugh', ['reir'], 'se ríe con', '😂', 'Envía un GIF de risa.'],
  ['shrug', [], 'se encoge de hombros ante', '🤷', 'Envía un GIF de encogimiento.'],
  ['sleep', ['dormir'], 'duerme junto a', '😴', 'Envía un GIF de sueño.'],
  ['think', ['pensar'], 'piensa en', '🤔', 'Envía un GIF pensando.'],
  ['thumbsup', ['like'], 'aprueba a', '👍', 'Envía un pulgar arriba.'],
]

export default definitions.map(([id, aliases, verb, emoji, description]) => ({
  commands: [id, ...aliases],
  category: 'anime',
  description,
  usage: '[@usuario]',
  async execute(ctx) {
    const target = requestedTargets(ctx, { text: false })[0]
    const sender = `@${cleanNumber(ctx.m.senderDisplay)}`
    const caption = target
      ? `${emoji} ${sender} ${verb} @${cleanNumber(target)}`
      : `${emoji} ${sender}: ${id}`
    await ctx.react(emoji)
    const media = await ctx.api.media(`/reactions/${id}`, { direct: 'true' })
    const animation = await gifPlaybackPayload(media, ctx.gifToMp4)
    await ctx.send({
      ...animation,
      caption,
      contextInfo: { mentionedJid: [ctx.m.sender, ...(target ? [target] : [])] },
    })
  },
}))
