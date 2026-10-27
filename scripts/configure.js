import { createInterface } from 'node:readline/promises'
import { ConfigStore } from '../src/config.js'
import { cleanNumber, normalizeCommand } from '../src/utils/format.js'

const store = new ConfigStore()
const rl = createInterface({ input: process.stdin, output: process.stdout })

async function ask(label, current) {
  const answer = (await rl.question(`${label} [${current}]: `)).trim()
  return answer || String(current)
}

try {
  await store.init({ watch: false })
  const current = store.data
  console.log('\n𓂃 ࣪ ִֶָ☾. CONFIGURACIÓN DE VELIRIUS BOT')
  console.log('Pulsa Enter para conservar el valor actual.\n')

  const botName = await ask('Nombre del bot', current.botName)
  const prefix = await ask('Prefijo', current.prefix)
  const owners = await ask(
    'Owners separados por coma (número:Nombre)',
    current.owners.map(owner => `${owner.number}:${owner.name}`).join(', '),
  )
  const ownerLids = await ask('Owner LIDs separados por coma (opcional)', current.ownerLids.join(','))
  const banner = await ask('Banner (ruta local o URL)', current.banner)
  const menuInput = normalizeCommand(await ask('Menú: interactive/list/text', current.menuMode))
  const modeInput = normalizeCommand(await ask('Modo: public/self', current.mode))
  const autoRead = normalizeCommand(await ask('Autolectura: on/off', current.autoRead ? 'on' : 'off'))
  const baseUrl = await ask('URL de Velirius API', current.api.baseUrl)

  const parsedOwners = owners.split(',').map((entry, index) => {
    const [number, ...name] = entry.trim().split(':')
    return {
      number: cleanNumber(number),
      name: name.join(':').trim() || current.owners.find(owner => owner.number === cleanNumber(number))?.name || `Owner ${index + 1}`,
    }
  }).filter(owner => owner.number)

  const menuAliases = { interactivo: 'interactive', lista: 'list', texto: 'text' }
  const modeAliases = { publico: 'public', privado: 'self' }

  await store.update(config => {
    config.botName = botName
    config.prefix = prefix
    config.owners = parsedOwners
    config.ownerLids = ownerLids.split(',').map(cleanNumber).filter(Boolean)
    config.banner = banner
    config.menuMode = menuAliases[menuInput] || menuInput
    config.mode = modeAliases[modeInput] || modeInput
    config.autoRead = autoRead === 'on'
    config.api.baseUrl = baseUrl
  })

  console.log('\n✔ Configuración guardada en config.json')
  console.log('✔ Si el bot está ejecutándose, los cambios se aplican automáticamente.\n')
} catch (error) {
  console.error(`\n✖ No se guardó la configuración: ${error.message}`)
  process.exitCode = 1
} finally {
  rl.close()
  await store.close()
}
