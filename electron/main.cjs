'use strict'

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, clipboard, nativeImage } = require('electron')
const { spawn } = require('node:child_process')
const net = require('node:net')
const path = require('node:path')
const fs = require('node:fs')
const QRCode = require('qrcode')

const ROOT = path.join(__dirname, '..')
const SERVER_ENTRY = path.join(ROOT, 'server-dist', 'index.js')
const TRAY_ICON = path.join(ROOT, 'build', 'tray.png')
const IPC_PREFIX = 'LANSHARE_IPC '
const BASE_PORT = 3000
const MAX_PORT_TRIES = 8

const userData = path.join(app.getPath('appData'), 'LAN Share')
const dataDir = path.join(userData, 'data')
app.setPath('userData', userData)
app.setAppUserModelId('com.lanshare.app')

let tray = null
let panel = null
let server = null
let restarting = false
const state = {
  phase: 'starting',
  url: null,
  pin: null,
  port: BASE_PORT,
  uploadDir: path.join(dataDir, 'Ficheiros'),
  interfaces: [],
  qr: null,
  message: 'A arrancar o servidor…',
}

function send(channel, payload) {
  if (panel && !panel.isDestroyed()) panel.webContents.send(channel, payload)
}

async function refreshQr() {
  state.qr = state.url
    ? await QRCode.toDataURL(state.url, { margin: 1, width: 512, color: { dark: '#0b0b0d', light: '#ffffff' } })
    : null
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

async function pickPort() {
  for (let port = BASE_PORT; port < BASE_PORT + MAX_PORT_TRIES; port++) {
    if (await freePort(port)) return port
  }
  return BASE_PORT
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
  const port = await pickPort()
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
        state.url = info.url
        state.pin = info.pin
        state.port = info.port
        state.uploadDir = info.uploadDir ?? state.uploadDir
        state.interfaces = info.interfaces ?? []
        state.phase = 'running'
        state.message = info.url ? 'A servir' : 'Sem interfaces de rede'
        void refreshQr()
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
    state.qr = null
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

function panelHtml() {
  return path.join(__dirname, 'panel.html')
}

function createPanel() {
  panel = new BrowserWindow({
    width: 440,
    height: 760,
    minWidth: 380,
    minHeight: 620,
    title: 'LAN Share',
    backgroundColor: '#0b0b0d',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(ROOT, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  panel.loadFile(panelHtml())
  panel.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') {
      console.error(`[panel] ${event.message} (${event.sourceId}:${event.lineNumber})`)
    }
  })
  panel.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[panel] falha ao carregar: ${description} (${code})`)
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

function buildTray() {
  if (!tray) return
  const running = state.phase === 'running' && state.url
  const label = state.pin ? `${state.url ?? 'sem rede'} · PIN ${state.pin}` : state.message
  tray.setToolTip(`LAN Share — ${label}`, { title: 'LAN Share' })
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `LAN Share — ${state.message}`, enabled: false },
      { type: 'separator' },
      { label: 'Mostrar painel', click: () => showPanel() },
      { label: 'Abrir no navegador', enabled: Boolean(state.url), click: () => openBrowser() },
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
      { label: running ? `Endereço: ${state.url}` : 'Servidor parado', enabled: false },
    ]),
  )
}

function openBrowser() {
  if (!state.url) return
  void shell.openExternal(state.url)
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
ipcMain.handle('open:browser', () => openBrowser())
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
  app.on('second-instance', () => showPanel())

  app.whenReady().then(async () => {
    if (!fs.existsSync(TRAY_ICON)) {
      // Em dev o ícone pode não existir; o tray degrada para o ícone do runtime.
    }
    tray = new Tray(fs.existsSync(TRAY_ICON) ? TRAY_ICON : nativeImage.createEmpty())
    buildTray()

    if (app.getLoginItemSettings().wasOpenedAsHidden) {
      buildTray()
    } else {
      createPanel()
    }
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