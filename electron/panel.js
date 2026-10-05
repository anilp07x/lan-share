'use strict'

const $ = (id) => document.getElementById(id)
let pinVisible = false
let toastTimer = null

function toast(text) {
  let node = document.querySelector('.toast')
  if (!node) {
    node = document.createElement('div')
    node.className = 'toast'
    document.body.append(node)
  }
  node.textContent = text
  requestAnimationFrame(() => node.classList.add('show'))
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('show'), 1600)
}

function render(state) {
  const status = $('status')
  status.dataset.phase = state.phase
  status.textContent =
    state.phase === 'running'
      ? state.url
        ? 'A servir na tua rede'
        : 'Sem interfaces de rede'
      : state.message

  $('qr').src = state.qr ?? ''
  $('qrFrame').hidden = !state.qr
  $('qrHint').hidden = Boolean(state.qr)
  $('qrHint').textContent = state.url
    ? 'Aponta a câmara do telemóvel para este código.'
    : 'Liga este computador a uma rede Wi-Fi ou a um cabo.'

  $('url').textContent = state.url ?? `http://localhost:${state.port}`
  $('pin').textContent = state.pin ? (pinVisible ? state.pin : '••••••') : '—'
  $('togglePin').disabled = !state.pin

  const list = $('ifaceList')
  const others = (state.interfaces ?? []).filter((i) => i.url !== state.url)
  $('interfaces').hidden = others.length === 0
  list.replaceChildren(
    ...others.map((iface) => {
      const li = document.createElement('li')
      li.textContent = `${iface.iface}: ${iface.url}`
      return li
    }),
  )

  $('openBrowser').disabled = !state.url
  $('copyUrl').disabled = !state.url
  $('copyPin').disabled = !state.pin
}

$('togglePin').addEventListener('click', () => {
  pinVisible = !pinVisible
  $('togglePin').textContent = pinVisible ? 'Ocultar' : 'Mostrar'
  window.lanShare.getState().then(render)
})
$('copyUrl').addEventListener('click', () => window.lanShare.copy($('url').textContent).then(() => toast('Endereço copiado')))
$('copyPin').addEventListener('click', () => window.lanShare.getState().then((s) => window.lanShare.copy(s.pin).then(() => toast('PIN copiado'))))
$('openBrowser').addEventListener('click', () => window.lanShare.openBrowser())
$('openFolder').addEventListener('click', () => window.lanShare.openFolder())
$('restart').addEventListener('click', () => {
  $('restart').disabled = true
  window.lanShare.restart().finally(() => setTimeout(() => ($('restart').disabled = false), 1500))
})
$('quit').addEventListener('click', () => window.lanShare.quit())
$('autostart').addEventListener('change', (event) => {
  window.lanShare.setAutoStart(event.target.checked)
  toast(event.target.checked ? 'Arrancará com o Windows' : 'Não arrancará com o Windows')
})

window.lanShare.onState(render)
Promise.all([window.lanShare.getState(), window.lanShare.getAutoStart()]).then(([state, autoStart]) => {
  $('autostart').checked = autoStart
  render(state)
})