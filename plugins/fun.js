import { createHash } from 'node:crypto'
import { cleanNumber } from '../src/utils/format.js'

function percentage(command, jid) {
  const day = new Date().toISOString().slice(0, 10)
  const digest = createHash('sha256').update(`${command}:${day}:${jid}`).digest()
  return digest[0] % 101
}

function funTop(command, label) {
  return {
    commands: [command],
    category: 'diversion',
    description: `Genera un top diario de ${label}.`,
    group: true,
    needsGroupMetadata: true,
    async execute(ctx) {
      const ranking = ctx.participants.map(participant => ({
        jid: participant.id,
        value: percentage(command, participant.id),
      })).filter(item => item.jid).sort((a, b) => b.value - a.value).slice(0, 10)
      if (!ranking.length) return ctx.reply('☾ No hay participantes para clasificar.')
      await ctx.reply(
        `🎭 *TOP ${label.toUpperCase()} DEL DÍA*\n${ranking.map((item, index) =>
          `> ${index + 1}. @${cleanNumber(item.jid)} · *${item.value}%*`).join('\n')}`,
        { contextInfo: { mentionedJid: ranking.map(item => item.jid) } },
      )
    },
  }
}

export default [
  funTop('topgays', 'gays'),
  funTop('topotakus', 'otakus'),
  funTop('topfemboys', 'femboys'),
]
