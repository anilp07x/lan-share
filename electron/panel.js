'use strict'

const $ = (id) => document.getElementById(id)
let pinVisible = false
let toastTimer = null
let mode = 'plain'
let current = null

function toast(text) {
  let node = document.querySelector('.toast')
  if (!node) {
    node = document.createElement('div')
    node.className = 'toast'
    node.setAttribute('role', 'status')
    document.body.append(node)
  }
  node.textContent = text
  requestAnimationFrame(() => node.classList.add('show'))
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('show'), 1800)
}

/** Endereço e QR conforme o tipo de ligação escolhido (normal ou segura). */
function target(state) {
  if (mode === 'secure' && state.secureUrl) return { url: state.secureUrl, qr: state.qrSecure }
  return { url: state.url, qr: state.qr }
}

function render(state) {
  current = state
  const running = state.phase === 'running'
  $('dot').dataset.phase = state.phase
  $('status').textContent = running ? (state.url ? 'A servir na tua rede' : 'Sem interfaces de rede') : state.message

  $('modes').hidden = !state.secureUrl
  if (!state.secureUrl) mode = 'plain'
  for (const b of document.querySelectorAll('#modes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode))

  const t = target(state)
  $('qr').src = t.qr ?? ''
  $('qrFrame').hidden = !t.qr
  $('qrHint').hidden = Boolean(t.qr)
  $('qrHint').textContent = state.url
    ? 'A preparar o código QR…'
    : 'Liga este computador a uma rede Wi-Fi ou a um cabo.'
  $('url').textContent = t.url ?? `http://localhost:${state.port}`
  $('modeHint').textContent =
    mode === 'secure'
      ? 'Só abre sem avisos em dispositivos com o certificado instalado. Dá avisos do sistema.'
      : state.secureUrl
        ? 'Funciona em qualquer dispositivo da rede, sem instalar nada.'
        : ''

  $('pin').textContent = state.pin ? (pinVisible ? state.pin : '••••••') : '—'
  $('togglePin').disabled = !state.pin
  $('copyPin').disabled = !state.pin

  const others = (state.interfaces ?? []).filter((i) => i.url !== state.url)
  $('interfaces').hidden = others.length === 0
  $('ifaceList').replaceChildren(
    ...others.map((iface) => {
      const li = document.createElement('li')
      li.textContent = `${iface.iface}: ${iface.url}`
      return li
    }),
  )

  $('secureCard').hidden = !state.caFile
  $('openApp').disabled = !running
  $('copyUrl').disabled = !t.url
}

for (const b of document.querySelectorAll('#modes button')) {
  b.addEventListener('click', () => {
    mode = b.dataset.mode
    if (current) render(current)
  })
}
$('togglePin').addEventListener('click', () => {
  pinVisible = !pinVisible
  $('togglePin').textContent = pinVisible ? 'Ocultar' : 'Mostrar'
  if (current) render(current)
})
$('copyUrl').addEventListener('click', () => window.lanShare.copy($('url').textContent).then(() => toast('Endereço copiado')))
$('copyPin').addEventListener('click', () => current?.pin && window.lanShare.copy(current.pin).then(() => toast('PIN copiado')))
$('openApp').addEventListener('click', () => window.lanShare.openApp())
$('openFolder').addEventListener('click', () => window.lanShare.openFolder())
$('installCa').addEventListener('click', () => {
  $('installCa').disabled = true
  window.lanShare
    .installCa()
    .then((ok) => toast(ok ? 'Certificado instalado neste PC' : 'Instalação cancelada'))
    .finally(() => ($('installCa').disabled = false))
})
$('restart').addEventListener('click', () => {
  $('restart').disabled = true
  window.lanShare.restart().finally(() => setTimeout(() => ($('restart').disabled = false), 1500))
})
$('quit').addEventListener('click', () => window.lanShare.quit())
$('autostart').addEventListener('change', (event) => {
  window.lanShare.setAutoStart(event.target.checked)
  toast(event.target.checked ? 'Arranca com o Windows' : 'Não arranca com o Windows')
})

window.lanShare.onState(render)
Promise.all([window.lanShare.getState(), window.lanShare.getAutoStart()]).then(([state, autoStart]) => {
  $('autostart').checked = autoStart
  render(state)
})
