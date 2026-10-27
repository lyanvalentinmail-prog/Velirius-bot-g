import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function sharpWorks() {
  const script = `
    import sharp from 'sharp'
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).png().toBuffer()
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    stdio: 'ignore',
    timeout: 30000,
  })
  return result.status === 0
}

function installWasm() {
  const npmArgs = [
    'install',
    'sharp@0.35.5',
    '@img/sharp-wasm32@0.35.5',
    '--cpu=wasm32',
    '--no-bin-links',
    '--no-audit',
    '--no-fund',
  ]
  const useNpmCli = Boolean(process.env.npm_execpath)
  const command = useNpmCli ? process.execPath : 'npm'
  const args = useNpmCli ? [process.env.npm_execpath, ...npmArgs] : npmArgs
  return spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      npm_config_cpu: 'wasm32',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
    timeout: 180000,
  }).status === 0
}

if (sharpWorks()) {
  console.log('☾ Sharp disponible')
} else {
  console.log('☾ Sharp nativo no disponible; preparando WebAssembly para Termux…')
  const installed = installWasm()
  if (installed && sharpWorks()) {
    console.log('✔ Sharp WebAssembly disponible')
  } else {
    console.warn('⚠ Sharp no pudo prepararse; el bot continuará sin algunas miniaturas.')
    console.warn('  Para reintentarlo: npm run fix:sharp')
  }
}
