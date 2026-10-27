import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { normalizeCommand } from './utils/format.js'

export class PluginRegistry {
  constructor(directory = './plugins') {
    this.directory = path.resolve(directory)
    this.list = []
    this.commands = new Map()
    this.files = []
  }

  async load() {
    const entries = (await readdir(this.directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
      .sort((a, b) => a.name.localeCompare(b.name))
    const list = []
    const commands = new Map()
    const files = []

    for (const entry of entries) {
      const file = path.join(this.directory, entry.name)
      const info = await stat(file)
      const moduleUrl = `${pathToFileURL(file).href}?updated=${info.mtimeMs}`
      const imported = await import(moduleUrl)
      const definitions = Array.isArray(imported.default) ? imported.default : [imported.default]

      for (const definition of definitions) {
        if (!definition || typeof definition.execute !== 'function') {
          throw new Error(`${entry.name}: el plugin debe exportar execute()`)
        }
        if (!Array.isArray(definition.commands) || !definition.commands.length) {
          throw new Error(`${entry.name}: falta el arreglo commands`)
        }
        const plugin = {
          category: 'general',
          description: 'Sin descripción',
          usage: '',
          ...definition,
          commands: [...new Set(definition.commands.map(normalizeCommand).filter(Boolean))],
          file: entry.name,
        }
        for (const command of plugin.commands) {
          if (commands.has(command)) {
            throw new Error(`Comando duplicado "${command}" en ${entry.name} y ${commands.get(command).file}`)
          }
          commands.set(command, plugin)
        }
        list.push(plugin)
      }
      files.push(file)
    }

    this.list = list
    this.commands = commands
    this.files = files
    return this
  }

  reload() {
    return this.load()
  }

  get(command) {
    return this.commands.get(normalizeCommand(command)) || null
  }

  get count() {
    return this.list.length
  }
}
