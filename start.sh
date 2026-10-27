#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "✖ Node.js no está instalado. En Termux ejecuta: pkg install nodejs"
  exit 1
fi

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 20 || (major === 20 && minor < 9)) process.exit(1)" || {
  echo "✖ Se necesita Node.js 20.9 o superior."
  exit 1
}

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund || exit 1
fi

node scripts/ensure-sharp.js

while true; do
  node index.js "$@"
  code=$?
  if [ "$code" -eq 0 ]; then
    exit 0
  fi
  if [ "$code" -eq 42 ]; then
    echo "↻ Reinicio solicitado por el bot…"
  else
    echo "⚠ El proceso terminó con código $code. Reiniciando en 8 segundos…"
    sleep 8
  fi
done
