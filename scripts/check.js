import { access, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { ConfigStore } from '../src/config.js'
import { PluginRegistry } from '../src/plugins.js'
import { isHttpUrl } from '../src/utils/format.js'

async function JavaScriptFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await JavaScriptFiles(file))
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(file)
  }
  return files
}

const files = ['index.js', ...await JavaScriptFiles('src'), ...await JavaScriptFiles('plugins'), ...await JavaScriptFiles('scripts')]
for (const file of files) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (checked.status !== 0) {
    console.error(checked.stderr || checked.stdout)
    process.exit(1)
  }
}

const config = new ConfigStore()
await config.init({ watch: false })
if (!isHttpUrl(config.data.banner)) await access(path.resolve(config.data.banner))
const registry = await new PluginRegistry().load()
await config.close()

console.log(`✔ Sintaxis correcta: ${files.length} archivos`)
console.log(`✔ Configuración válida y banner disponible`)
console.log(`✔ Plugins válidos: ${registry.count} comandos (${registry.commands.size} alias)`)
