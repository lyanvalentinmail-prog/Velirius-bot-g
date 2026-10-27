import { chatData } from './chat.js'
import { cleanNumber } from './format.js'

export function registerWelcome(sock, database) {
  sock.ev.on('group-participants.update', async update => {
    try {
      if (update.action !== 'add') return
      if (!chatData(database, update.id).settings.welcome) return
      const participants = (update.participants || []).filter(Boolean)
      if (!participants.length) return
      await sock.sendMessage(update.id, {
        text: `👋 *BIENVENIDO/A*\n${participants.map(jid => `@${cleanNumber(jid)}`).join('\n')}\n> El grupo te saluda.`,
        contextInfo: { mentionedJid: participants },
      })
    } catch (error) {
      console.error(`⚠ No se pudo enviar la bienvenida: ${error.message}`)
    }
  })
}
