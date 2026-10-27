# ☾ Velirius Bot

Bot modular de **WhatsApp Multi Device**, pensado para **Termux**, construido con **Baileys** y los endpoints públicos de **[Velirius API](https://velirius-api-sd8u.vercel.app/home)**.

Incluye vinculación por **código QR** o **código de emparejamiento**, menú con banner, listas interactivas (`nativeFlow`), listas clásicas (`listMessage`) y alternativa automática en texto. Su estructura de plugins está inspirada en bots como Pain-Bot, pero el proyecto es independiente y delega la edición multimedia compleja en Velirius API.

## Características

- Node.js 20.9+ y Baileys Multi Device.
- Configuración editable en caliente: prefijo, owners, nombre, banner, menú, modo y API.
- Asistente de configuración para Termux: `npm run setup`.
- Permisos compatibles con números normales (`PN`) e identificadores `@lid`.
- Menú generado automáticamente desde los plugins cargados.
- 86 comandos iniciales y más de 170 alias.
- Descargas, búsquedas, anime, canvas, herramientas, 26 reacciones y administración de grupos.
- Base de datos JSON local para actividad y estadísticas.
- Cooldown, modo público/privado y límite de tamaño para descargas.
- Reconexión automática y script con reinicio del proceso.
- Sin token para Velirius API.

## Instalación en Termux

### Instalación automática

Si ya clonaste el repositorio:

```bash
cd Velirius-bot-g
bash scripts/install-termux.sh
```

El instalador ejecuta `pkg update`, instala Node.js, Git y Nano, instala las dependencias con `npm ci` y comprueba el soporte de imágenes de Baileys. En Android, si `sharp` no tiene binario nativo, se prepara automáticamente su variante WebAssembly.

### Instalación manual completa

```bash
pkg update -y
pkg install -y nodejs git nano

git clone https://github.com/lyanvalentinmail-prog/Velirius-bot-g.git
cd Velirius-bot-g
npm ci
```

Comprueba que Node.js sea 20.9 o superior:

```bash
node --version
```

## Configuración

Antes de iniciar, ejecuta:

```bash
npm run setup
```

Pulsa **Enter** para conservar cada valor. En el campo de owners puedes usar uno o varios valores con este formato:

```text
59896719709:Lyann, 59891234567:Otro Owner
```

También puedes editar directamente:

```bash
nano config.json
```

El archivo se vuelve a cargar automáticamente cuando cambia. Si el JSON tiene un error, el bot conserva la última configuración válida y muestra el problema en la terminal.

### Opciones principales

| Opción | Descripción |
|---|---|
| `botName` | Nombre visible del bot. |
| `prefix` | Prefijo de comandos, de 1 a 3 caracteres. |
| `owners` | Números con código de país y nombre visible. |
| `ownerLids` | LIDs de owners; útil cuando WhatsApp no expone el número. |
| `banner` | Ruta local (`./assets/banner.jpg`) o URL HTTP(S). |
| `menuMode` | `interactive`, `list` o `text`. |
| `mode` | `public` para todos o `self` sólo para owners. |
| `sessionDir` | Carpeta de credenciales; por defecto `./sessions`. |
| `autoRead` | Marca mensajes como leídos. |
| `cooldownMs` | Espera entre usos del mismo comando por usuario. |
| `api.baseUrl` | URL base de Velirius API, sin `/` final obligatorio. |
| `api.timeoutMs` | Tiempo máximo de espera de la API. |
| `api.maxMediaMB` | Límite de descarga en memoria; por defecto 64 MB. |

La configuración inicial contiene el owner indicado en el menú: **59896719709 · Lyann**. Cámbialo si otra persona administrará el bot.

## Vincular WhatsApp

### Elección interactiva

```bash
npm start
```

Cuando no existe una sesión, el bot pregunta si quieres usar QR o pairing code.

### Código QR

```bash
npm start -- --qr
```

En WhatsApp abre **Dispositivos vinculados → Vincular un dispositivo** y escanea el QR de Termux.

### Código de emparejamiento

Usa el número de la cuenta que funcionará como bot, con código de país y sin `+`, espacios ni guiones:

```bash
npm start -- --pairing --phone=59896719709
```

En WhatsApp abre **Dispositivos vinculados → Vincular con número de teléfono** e introduce el código mostrado. El código caduca.

### Reinicio automático

```bash
./start.sh
```

`start.sh` vuelve a iniciar el proceso después de un fallo y admite los mismos argumentos:

```bash
./start.sh --pairing --phone=59896719709
```

El comando owner `.restart` está pensado para usarlo con este script.

## Editar el bot desde WhatsApp

Estos comandos sólo funcionan para owners:

```text
.setprefix !
.setbotname VELIRIUS BOT
.setfooter 𓂃 ࣪ ִֶָ☾. Mi Bot
.setbanner https://ejemplo.com/banner.jpg
.setbanner ./assets/banner.jpg
.setmenu interactivo
.setmenu lista
.setmenu texto
.setmode public
.setmode self
.setautoread on
.addowner 59891234567 Nombre
.delowner 59891234567
.setapi https://velirius-api-sd8u.vercel.app
.config
.reload
.restart
```

Para `.setbanner` también puedes **responder a una imagen** y enviar solamente `.setbanner`. Para agregar un owner puedes mencionar o responder a esa persona. El bot no permite eliminar el último owner.

Si un usuario aparece como `@lid`, utiliza `.id` para conocer sus identificadores y agrega el número de LID a `ownerLids` en `config.json` o mediante `.addowner` respondiendo a su mensaje.

## Menús y compatibilidad con listas

El modo predeterminado es `interactive`: envía banner y un botón de selección mediante `nativeFlow`. También puedes usar:

- `list`: mensaje `listMessage` clásico.
- `text`: banner y comandos en texto, sin elementos interactivos.

Los dos modos de lista incorporan los nodos `biz` requeridos por WhatsApp. Al seleccionar una categoría, el bot interpreta su ID y devuelve los comandos correspondientes.

La visualización final depende de la versión de WhatsApp. Si una lista no aparece en un cliente, el bot intenta otras formas de envío; también puedes forzar `.setmenu texto`.

## Ejemplos de comandos

El menú completo se obtiene con `.menu` (o con el prefijo que hayas configurado).

### General

```text
.menu
.menu descargas
.ping
.infobot
.estadoapi
.perfil
.owner
.id
```

### Descargas y búsquedas

```text
.play Twice I Can't Stop Me
.mp3 https://www.youtube.com/watch?v=...
.mp4 https://www.youtube.com/watch?v=... 720
.tiktok https://vt.tiktok.com/...
.tiktokaudio https://vt.tiktok.com/...
.fb https://www.facebook.com/watch/?v=...
.ig https://www.instagram.com/reel/...
.pindl https://www.pinterest.com/pin/...
.letra Kendrick Lamar Humble
.yts Velirius API
.google Velirius API
.ttsearch anime edit
.pinterest gatos aesthetic
.wiki One Piece
```

Descarga únicamente contenido que tengas permiso para guardar o compartir. Los proveedores pueden bloquear algunos enlaces; en ese caso la API devolverá el error correspondiente.

### Herramientas y canvas

```text
.calc (2+3)*4^2 + sqrt(81)
.traducir en Hola, ¿cómo estás?
.tts es Hola, soy Velirius Bot
.morse SOS
.morse decode ... --- ...
.brat Velirius Bot
.bratvideo Palabras progresivas
.ttp VELIRIUS
.quotly Hola a todos
.emojimix 😀 😂
.resize 512 512
```

`quotly` y `resize` aceptan una imagen respondida. Las imágenes se suben temporalmente a `/upload` de Velirius API para generar el canvas; el servicio indica que estas subidas expiran a los 30 minutos.

### Anime y reacciones

```text
.neko
.waifu
.maid
.pokemon pikachu
.pokemon charizard shiny
.hug @usuario
.kiss @usuario
.pat @usuario
.dance
.laugh
```

Las 26 reacciones usan las rutas `/reactions/:reaction` de Velirius API y contenido SFW.

### Grupos

Incluye `kick`, `add`, `promote`, `demote`, `open`, `close`, `setgroupname`, `setgroupdesc`, `tagall`, `delete`, `link` e `infogroup`. Las acciones que modifican el grupo requieren que el usuario y/o el bot tengan los permisos correspondientes.

## Endpoints de Velirius API utilizados

- `/anime/*`
- `/canvas/*`
- `/downloader/*`
- `/reactions/*`
- `/searcher/*`
- `/tools/*`
- `/upload`
- `/docs` para comprobar el estado

La URL se puede cambiar con `setapi` o en `config.json`. No se necesita token.

## Crear un plugin

Guarda un archivo `.js` dentro de `plugins/`:

```js
export default {
  commands: ['hola', 'saludo'],
  category: 'general',
  description: 'Responde con un saludo.',
  usage: '[nombre]',
  async execute(ctx) {
    await ctx.reply(`Hola ${ctx.text || ctx.m.name} ☾`)
  },
}
```

Después ejecuta `.reload` como owner o reinicia el bot. El menú incluirá el comando automáticamente.

Propiedades opcionales de permisos:

```js
{
  owner: true,       // sólo owners
  group: true,       // sólo grupos
  private: true,     // sólo privado
  admin: true,       // admin del grupo u owner
  botAdmin: true,    // el bot debe ser admin
  needsGroupMetadata: true,
}
```

Un archivo también puede exportar un arreglo de plugins con `export default [...]`.

## Estructura

```text
├── index.js                 # Conexión, QR, pairing y reconexión
├── config.json              # Configuración editable
├── plugins/                 # Comandos cargados dinámicamente
├── src/
│   ├── api.js               # Cliente de Velirius API
│   ├── handler.js           # Prefijos, permisos y contexto
│   ├── interactive.js       # nativeFlow y listMessage
│   ├── menu.js              # Diseño del menú
│   └── utils/               # Mensajes, JID/LID, grupos y medios
├── scripts/
│   ├── configure.js         # Asistente de configuración
│   ├── install-termux.sh    # Instalador
│   └── check.js             # Validaciones
├── tests/
└── start.sh                 # Reinicio automático
```

## Comprobaciones

```bash
npm run check
npm test
```

`check` valida sintaxis, configuración, banner y duplicados de comandos. Las pruebas cubren configuración, mensajes, listas, API, menú y carga de plugins; no inician una sesión real de WhatsApp.

## Solución de problemas

### El QR o pairing no aparece

Cierra el proceso con `Ctrl+C` y vuelve a intentarlo. Si la sesión quedó dañada, detén el bot y elimina únicamente la carpeta `sessions` para volver a vincular.

### WhatsApp cerró la sesión

Vincula de nuevo. No compartas la carpeta `sessions`: contiene credenciales de acceso.

### La lista no se ve

Prueba `.setmenu lista`; si el cliente sigue sin mostrarla, usa `.setmenu texto`.

### Una descarga supera la memoria

Reduce `api.maxMediaMB` para proteger el teléfono o auméntalo sólo si tienes memoria suficiente. Cuando se alcanza el límite, el bot ofrece el enlace directo si está disponible.

### Un plugin nuevo no aparece

Revisa la terminal, ejecuta `npm run check` y después `.reload`.

### Sharp falla en Android o no genera miniaturas

El arranque intenta corregirlo automáticamente. Para repetir la comprobación manualmente:

```bash
npm run fix:sharp
```

El bot puede continuar sin Sharp, pero algunas miniaturas de imagen o video podrían no generarse.

### Actualizar el proyecto

```bash
git pull
npm ci
npm run check
```

## Privacidad y aviso

- `sessions/`, `data/*.json`, banners personalizados y variables de entorno están ignorados por Git.
- No publiques credenciales ni bases de datos de usuarios.
- Evita spam y respeta las reglas de los grupos.
- Este proyecto es una integración no oficial con WhatsApp y no está afiliado a WhatsApp LLC ni a Meta. El uso de clientes no oficiales puede implicar restricciones de la cuenta; úsalo bajo tu propia responsabilidad.

## Licencia

MIT. Baileys y Velirius API conservan sus respectivas licencias y avisos.
