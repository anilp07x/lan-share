'use strict'

const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, clipboard, nativeImage, session } = require('electron')
const { spawn, execFile } = require('node:child_process')
const net = require('node:net')
const path = require('node:path')
const fs = require('node:fs')
const QRCode = require('qrcode')

const ROOT = path.join(__dirname, '..')
const SERVER_ENTRY = path.join(ROOT, 'server-dist', 'index.js')
const TRAY_ICON = path.join(ROOT, 'build', 'tray.png')
const APP_ICON = path.join(ROOT, 'build', 'icon.png')
const IPC_PREFIX = 'LANSHARE_IPC '
const BASE_PORT = 3000
const BASE_HTTPS_PORT = 3443
const MAX_PORT_TRIES = 8
// sessão própria e persistente: guarda o nome do dispositivo e as preferências da app
const APP_PARTITION = 'persist:lanshare'

const userData = path.join(app.getPath('appData'), 'LAN Share')
const dataDir = path.join(userData, 'data')
app.setPath('userData', userData)
app.setAppUserModelId('com.lanshare.app')

let tray = null
let panel = null
let appWindow = null
let server = null
let restarting = false
const state = {
  phase: 'starting',
  url: null,
  secureUrl: null,
  mdnsUrl: null,
  caFile: null,
  pin: null,
  port: BASE_PORT,
  uploadDir: path.join(dataDir, 'Ficheiros'),
  interfaces: [],
  qr: null,
  qrSecure: null,
  message: 'A arrancar o servidor…',
}

function send(channel, payload) {
  if (panel && !panel.isDestroyed()) panel.webContents.send(channel, payload)
}

const qrOf = (text) =>
  text ? QRCode.toDataURL(text, { margin: 1, width: 512, color: { dark: '#13201b', light: '#ffffff' } }) : null

async function refreshQr() {
  ;[state.qr, state.qrSecure] = await Promise.all([qrOf(state.url), qrOf(state.secureUrl)])
  broadcast()
}

function broadcast() {
  send('state', state)
  buildTray()
}

function freePort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, '0.0.0.0')
  })
}

async function pickPort(base, avoid) {
  for (let port = base; port < base + MAX_PORT_TRIES; port++) {
    if (port !== avoid && (await freePort(port))) return port
  }
  return base
}

function tail(text, lines = 3) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-lines)
    .join('\n')
}

function stopServer(signal = 'SIGTERM') {
  if (!server) return
  const child = server
  server = null
  child.kill(signal)
}

async function startServer() {
  if (server) return
  if (!fs.existsSync(SERVER_ENTRY)) {
    state.phase = 'error'
    state.message = 'Servidor em falta. Corre "npm run build:server".'
    return broadcast()
  }

  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(state.uploadDir, { recursive: true })
  const port = await pickPort(BASE_PORT)
  const httpsPort = await pickPort(BASE_HTTPS_PORT, port)
  state.port = port
  state.phase = 'starting'
  state.message = 'A arrancar o servidor…'
  broadcast()

  // ELECTRON_RUN_AS_NODE faz o mesmo executável correr como Node puro.
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: userData,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      LANSHARE_IPC: '1',
      PORT: String(port),
      HTTPS_PORT: String(httpsPort),
      UPLOAD_DIR: state.uploadDir,
    },
  })
  server = child

  let stderr = ''
  let outBuffer = ''
  child.stderr.on('data', (chunk) => {
    stderr = tail(stderr + chunk.toString())
  })
  child.stdout.on('data', (chunk) => {
    outBuffer += chunk.toString()
    const lines = outBuffer.split(/\r?\n/)
    outBuffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith(IPC_PREFIX)) continue
      try {
        const info = JSON.parse(line.slice(IPC_PREFIX.length))
        const pinChanged = info.pin !== state.pin
        state.url = info.url
        state.secureUrl = info.secureUrl ?? null
        state.mdnsUrl = info.mdnsUrl ?? null
        state.caFile = info.caFile ?? null
        state.pin = info.pin
        state.port = info.port
        state.uploadDir = info.uploadDir ?? state.uploadDir
        state.interfaces = info.interfaces ?? []
        state.phase = 'running'
        state.message = info.url ? 'A servir' : 'Sem interfaces de rede'
        void refreshQr()
        // servidor novo = PIN novo: a janela da app volta a entrar sozinha
        if (pinChanged) void loadApp()
      } catch {
        /* linha malformada: ignora */
      }
    }
  })

  child.on('error', (err) => {
    state.phase = 'error'
    state.message = `Não foi possível arrancar o servidor: ${err.message}`
    server = null
    broadcast()
  })

  child.on('exit', (code, sig) => {
    if (server !== child) return
    server = null
    if (app.isQuitting) return
    state.phase = 'error'
    state.url = null
    state.secureUrl = null
    state.qr = null
    state.qrSecure = null
    state.message =
      code === 1
        ? `A porta ${state.port} pode estar ocupada. Reabre a app para tentar outra.`
        : `O servidor parou (${sig ?? code}). ${stderr ? tail(stderr, 2) : ''}`.trim()
    broadcast()
    if (!restarting) {
      restarting = true
      setTimeout(() => {
        restarting = false
        void startServer()
      }, 2000)
    }
  })
}

// ── janela da app: a interface web, com sessão iniciada e avisos nativos ──

const localUrl = () => `http://localhost:${state.port}`

/** Entra com o PIN do próprio servidor e guarda a sessão na janela da app. */
async function signIn() {
  if (!state.pin) return
  const res = await fetch(`${localUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: state.pin }),
  })
  if (!res.ok) return
  const jar = session.fromPartition(APP_PARTITION).cookies
  for (const raw of res.headers.getSetCookie()) {
    const pair = raw.split(';')[0] ?? ''
    const eq = pair.indexOf('=')
    if (eq <= 0) continue
    await jar.set({ url: localUrl(), name: pair.slice(0, eq), value: pair.slice(eq + 1), httpOnly: true, sameSite: 'strict' })
  }
}

function createAppWindow(show) {
  appWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 380,
    minHeight: 560,
    title: 'LAN Share',
    backgroundColor: '#16302a',
    // mostra logo o fundo do casco; a interface entra quando o servidor estiver pronto
    show,
    autoHideMenuBar: true,
    icon: APP_ICON,
    webPreferences: {
      partition: APP_PARTITION,
      preload: path.join(__dirname, 'app-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // escondida no tabuleiro continua a receber envios (e a avisar)
      backgroundThrottling: false,
    },
  })
  const wc = appWindow.webContents
  // links externos abrem no browser; a janela nunca sai do servidor local
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(localUrl())) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })
  appWindow.on('close', (event) => {
    if (app.isQuitting) return
    event.preventDefault()
    appWindow.hide()
  })
}

async function loadApp() {
  if (!appWindow || appWindow.isDestroyed() || state.phase !== 'running') return
  try {
    await signIn()
  } catch {
    /* sem sessão a app mostra o ecrã do PIN */
  }
  await appWindow.loadURL(localUrl()).catch(() => {})
}

function showApp() {
  if (!appWindow || appWindow.isDestroyed()) {
    createAppWindow(true)
    void loadApp()
    return
  }
  if (appWindow.isMinimized()) appWindow.restore()
  appWindow.show()
  appWindow.focus()
}

// o PIN aparece no diálogo "Ligar outro dispositivo" da janela da app
ipcMain.handle('desktop:pin', (event) => (appWindow && event.sender === appWindow.webContents ? state.pin : null))

ipcMain.on('desktop:notify', (event, payload) => {
  if (!appWindow || event.sender !== appWindow.webContents || !Notification.isSupported()) return
  const { title, body } = payload ?? {}
  if (typeof title !== 'string' || typeof body !== 'string') return
  if (process.env.LANSHARE_DEBUG) console.log(`[aviso] ${title}: ${body}`)
  const n = new Notification({ title, body, icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined })
  n.on('click', () => showApp())
  n.show()
})

// ── painel do servidor (PIN, QR, certificado) ─────────────────────────

function createPanel() {
  panel = new BrowserWindow({
    width: 440,
    height: 800,
    minWidth: 380,
    minHeight: 620,
    title: 'LAN Share — servidor',
    backgroundColor: '#16302a',
    show: false,
    autoHideMenuBar: true,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  panel.loadFile(path.join(__dirname, 'panel.html'))
  panel.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') {
      console.error(`[panel] ${event.message} (${event.sourceId}:${event.lineNumber})`)
    }
  })
  panel.once('ready-to-show', () => panel.show())
  panel.on('close', (event) => {
    if (app.isQuitting) return
    event.preventDefault()
    panel.hide()
  })
}

function showPanel() {
  if (!panel) createPanel()
  panel.show()
  panel.focus()
}

/** Instala a CA no arquivo do utilizador (o Windows pede confirmação). */
function installCa() {
  return new Promise((resolve) => {
    if (!state.caFile || process.platform !== 'win32') return resolve(false)
    execFile('certutil', ['-user', '-addstore', 'Root', state.caFile], { windowsHide: true }, (err) => resolve(!err))
  })
}

function buildTray() {
  if (!tray) return
  const label = state.pin ? `${state.url ?? 'sem rede'} · PIN ${state.pin}` : state.message
  tray.setToolTip(`LAN Share — ${label}`, { title: 'LAN Share' })
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `LAN Share — ${state.message}`, enabled: false },
      { type: 'separator' },
      { label: 'Abrir LAN Share', enabled: state.phase === 'running', click: () => showApp() },
      { label: 'Servidor (PIN e QR)', click: () => showPanel() },
      {
        label: 'Copiar endereço',
        enabled: Boolean(state.url),
        click: () => state.url && clipboard.writeText(state.url),
      },
      {
        label: 'Abrir pasta de ficheiros',
        click: () => fs.promises
          .mkdir(state.uploadDir, { recursive: true })
          .then(() => shell.openPath(state.uploadDir))
          .catch(() => {}),
      },
      { type: 'separator' },
      {
        label: 'Iniciar com o Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true })
          broadcast()
        },
      },
      { label: 'Reiniciar servidor', click: () => void restartServer() },
      { type: 'separator' },
      { label: 'Sair', click: () => void quit() },
    ]),
  )
}

async function restartServer() {
  stopServer()
  await new Promise((resolve) => setTimeout(resolve, 400))
  await startServer()
}

async function quit() {
  app.isQuitting = true
  const child = server
  stopServer()
  if (child) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        resolve()
      }, 4000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
  tray?.destroy()
  app.quit()
}

ipcMain.handle('state:get', () => state)
ipcMain.handle('panel:hide', () => panel?.hide())
ipcMain.handle('open:app', () => showApp())
ipcMain.handle('ca:install', () => installCa())
ipcMain.handle('copy:text', (_event, text) => {
  if (typeof text === 'string') clipboard.writeText(text)
  return true
})
ipcMain.handle('open:folder', async () => {
  await fs.promises.mkdir(state.uploadDir, { recursive: true })
  return shell.openPath(state.uploadDir)
})
ipcMain.handle('server:restart', () => restartServer())
ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin)
ipcMain.handle('autostart:set', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: true })
  return app.getLoginItemSettings().openAtLogin
})
ipcMain.handle('app:quit', () => void quit())

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showApp())

  app.whenReady().then(async () => {
    // Em dev o ícone pode não existir; o tray degrada para um ícone vazio.
    tray = new Tray(fs.existsSync(TRAY_ICON) ? TRAY_ICON : nativeImage.createEmpty())
    tray.on('click', () => showApp())
    buildTray()

    // a janela da app existe sempre (escondida ao arrancar com o Windows) para os avisos
    const hidden = app.getLoginItemSettings().wasOpenedAsHidden
    createAppWindow(!hidden)
    await startServer()
  })
}

app.on('window-all-closed', () => {
  /* app de tray: fica viva sem janelas */
})

app.on('before-quit', () => {
  app.isQuitting = true
  stopServer()
})
