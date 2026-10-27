import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cleanNumber, isHttpUrl, normalizeCommand } from '../src/utils/format.js'
import { requestedTargets } from '../src/utils/group.js'
import { isLid } from '../src/utils/jid.js'
import { downloadMessageMedia } from '../src/utils/media.js'

function ownerCommand(commands, description, usage, execute) {
  return { commands, category: 'owner', description, usage, owner: true, execute }
}

const menuModes = {
  interactivo: 'interactive',
  interactive: 'interactive',
  lista: 'list',
  list: 'list',
  texto: 'text',
  text: 'text',
}

export default [
  ownerCommand(['setprefix', 'cambiarprefijo'], 'Cambia el prefijo de los comandos.', '<nuevo prefijo>', async ctx => {
    if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setprefix !`)
    await ctx.configStore.update(config => { config.prefix = ctx.text })
    await ctx.reply(`☾ Prefijo actualizado a *${ctx.text}*.`)
  }),
  ownerCommand(['setbotname', 'setnamebot', 'setnombre'], 'Cambia el nombre visible del bot.', '<nuevo nombre>', async ctx => {
    if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setbotname VELIRIUS BOT`)
    await ctx.configStore.update(config => { config.botName = ctx.text })
    await ctx.reply(`☾ Nombre actualizado a *${ctx.text}*.`)
  }),
  ownerCommand(['setfooter', 'setpie'], 'Cambia el pie del menú interactivo.', '<texto>', async ctx => {
    if (!ctx.text) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setfooter Mi bot`)
    await ctx.configStore.update(config => { config.footer = ctx.text })
    await ctx.reply('☾ Pie del menú actualizado.')
  }),
  ownerCommand(['setbanner', 'setbotimg'], 'Cambia el banner por URL, ruta o imagen respondida.', '[url o ruta]', async ctx => {
    let banner = ctx.text
    if (banner) {
      if (!isHttpUrl(banner)) await access(path.resolve(banner))
    } else {
      const media = await downloadMessageMedia(ctx.m, { types: ['image'], maxBytes: 10 * 1024 * 1024 })
      if (!media) return ctx.reply('☾ Responde a una imagen o indica una URL/ruta local.')
      const extension = media.mimetype.includes('png') ? 'png' : media.mimetype.includes('webp') ? 'webp' : 'jpg'
      const file = path.resolve(`assets/banner-custom.${extension}`)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, media.buffer)
      banner = `./assets/banner-custom.${extension}`
    }
    await ctx.configStore.update(config => { config.banner = banner })
    await ctx.reply(`☾ Banner actualizado:\n${banner}`)
  }),
  ownerCommand(['setmenu', 'menutype'], 'Selecciona menú interactivo, lista o texto.', '<interactivo|lista|texto>', async ctx => {
    const mode = menuModes[normalizeCommand(ctx.text)]
    if (!mode) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setmenu interactivo|lista|texto`)
    await ctx.configStore.update(config => { config.menuMode = mode })
    await ctx.reply(`☾ Modo de menú actualizado a *${mode}*.`)
  }),
  ownerCommand(['setmode', 'modo'], 'Activa el modo público o privado.', '<public|self>', async ctx => {
    const aliases = { publico: 'public', public: 'public', privado: 'self', private: 'self', self: 'self' }
    const mode = aliases[normalizeCommand(ctx.text)]
    if (!mode) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setmode public|self`)
    await ctx.configStore.update(config => { config.mode = mode })
    await ctx.reply(`☾ Modo del bot: *${mode}*.`)
  }),
  ownerCommand(['setautoread', 'autoread', 'autolectura'], 'Activa o desactiva la lectura automática.', '<on|off>', async ctx => {
    const value = normalizeCommand(ctx.text)
    if (!['on', 'off'].includes(value)) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setautoread on|off`)
    await ctx.configStore.update(config => { config.autoRead = value === 'on' })
    await ctx.reply(`☾ Autolectura: *${value}*.`)
  }),
  ownerCommand(['setapi', 'apiurl'], 'Cambia la URL base de Velirius API.', '<https://...>', async ctx => {
    if (!isHttpUrl(ctx.text)) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}setapi https://velirius-api-sd8u.vercel.app`)
    await ctx.configStore.update(config => { config.api.baseUrl = ctx.text })
    await ctx.reply(`☾ API actualizada:\n${ctx.text}`)
  }),
  ownerCommand(['addowner', 'agregarowner'], 'Agrega un owner por mención, respuesta, número o LID.', '@usuario | número', async ctx => {
    const [target] = requestedTargets(ctx)
    if (!target) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}addowner 59896719709 Nombre`)
    const id = cleanNumber(target)
    if (isLid(target)) {
      await ctx.configStore.update(config => {
        if (!config.ownerLids.includes(id)) config.ownerLids.push(id)
      })
      return ctx.reply(`☾ Owner LID agregado: ${id}`)
    }
    const name = ctx.args.slice(1).join(' ').trim() || `Owner ${ctx.config.owners.length + 1}`
    await ctx.configStore.update(config => {
      if (!config.owners.some(owner => owner.number === id)) config.owners.push({ number: id, name })
    })
    await ctx.reply(`☾ Owner agregado: *${name}* (${id})`)
  }),
  ownerCommand(['delowner', 'eliminarowner'], 'Elimina un owner sin dejar el bot sin administradores.', '@usuario | número', async ctx => {
    const [target] = requestedTargets(ctx)
    if (!target) return ctx.reply(`☾ Uso: ${ctx.usedPrefix}delowner @usuario`)
    const id = cleanNumber(target)
    await ctx.configStore.update(config => {
      config.owners = config.owners.filter(owner => owner.number !== id)
      config.ownerLids = config.ownerLids.filter(lid => lid !== id)
    })
    await ctx.reply(`☾ Owner eliminado: ${id}`)
  }),
  ownerCommand(['reload', 'recargar'], 'Recarga configuración y plugins sin reiniciar.', '', async ctx => {
    await ctx.configStore.reload()
    await ctx.registry.reload()
    await ctx.reply(`☾ Recarga completa: ${ctx.registry.count} plugins disponibles.`)
  }),
  ownerCommand(['restart', 'reiniciar'], 'Reinicia el proceso (usa start.sh para volver solo).', '', async ctx => {
    await ctx.reply('☾ Reiniciando Velirius Bot…')
    setTimeout(() => ctx.runtime.restart?.(), 700)
  }),
  ownerCommand(['config', 'configuracion'], 'Muestra la configuración pública actual.', '', async ctx => {
    const config = ctx.configStore.data
    await ctx.reply(`☾ *CONFIGURACIÓN*\n> Nombre: ${config.botName}\n> Prefijo: ${config.prefix}\n> Menú: ${config.menuMode}\n> Modo: ${config.mode}\n> Banner: ${config.banner}\n> Owners: ${config.owners.length + config.ownerLids.length}\n> Autolectura: ${config.autoRead}\n> API: ${config.api.baseUrl}`)
  }),
]
