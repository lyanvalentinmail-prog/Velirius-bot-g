import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const initialData = () => ({
  users: {},
  chats: {},
  charShop: { nextOrder: 1, listings: [] },
  stats: { commands: {}, totalCommands: 0, startedAt: new Date().toISOString() },
})

export class Database {
  constructor(file = './data/database.json') {
    this.file = path.resolve(file)
    this.data = initialData()
    this.saveTimer = null
    this.writeQueue = Promise.resolve()
  }

  async init() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'))
      this.data = {
        ...initialData(),
        ...saved,
        charShop: { ...initialData().charShop, ...(saved.charShop || {}) },
        stats: { ...initialData().stats, ...(saved.stats || {}) },
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.error(`⚠ Base de datos reiniciada: ${error.message}`)
      await this.save()
    }
    return this
  }

  touchMessage(m) {
    const now = new Date().toISOString()
    const user = this.data.users[m.senderDisplay || m.sender] ||= {
      name: m.name,
      messages: 0,
      commands: 0,
      firstSeen: now,
    }
    if (!user.customName) user.name = m.name || user.name
    user.messages += 1
    user.lastSeen = now

    const chat = this.data.chats[m.chat] ||= { messages: 0, firstSeen: now }
    chat.messages += 1
    chat.lastSeen = now
    this.scheduleSave()
  }

  trackCommand(m, command) {
    const user = this.data.users[m.senderDisplay || m.sender]
    if (user) user.commands += 1
    this.data.stats.totalCommands += 1
    this.data.stats.commands[command] = (this.data.stats.commands[command] || 0) + 1
    this.scheduleSave()
  }

  scheduleSave() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.save().catch(error => console.error(`⚠ No se pudo guardar la base de datos: ${error.message}`))
    }, 5000)
    this.saveTimer.unref?.()
  }

  async save() {
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    const operation = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true })
      const temporary = `${this.file}.${process.pid}.tmp`
      await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 })
      await rename(temporary, this.file)
    })
    this.writeQueue = operation.catch(() => {})
    return operation
  }
}
