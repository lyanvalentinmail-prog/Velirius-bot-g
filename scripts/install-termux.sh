#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pkg >/dev/null 2>&1; then
  echo "✖ Este instalador está diseñado para Termux."
  echo "  En otro sistema instala Node.js 20.9+ y FFmpeg, y ejecuta npm ci."
  exit 1
fi

printf '\n𓂃 ࣪ ִֶָ☾. INSTALADOR DE VELIRIUS BOT\n\n'
pkg update -y
pkg install -y nodejs git nano ffmpeg

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 20 || (major === 20 && minor < 9)) { console.error('Se necesita Node.js 20.9+'); process.exit(1) }"
npm ci --no-audit --no-fund
node scripts/ensure-sharp.js
chmod +x start.sh scripts/install-termux.sh

printf '\n✔ Instalación completada.\n'
printf '  1. Edita la configuración: npm run setup\n'
printf '  2. Inicia con QR/pairing:  npm start\n'
printf '  3. O usa reinicio automático: ./start.sh\n\n'
