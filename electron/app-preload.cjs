'use strict'

// Janela da app (a mesma interface web): só ganha os avisos nativos do Windows.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lanShareDesktop', {
  getPin: () => ipcRenderer.invoke('desktop:pin'),
  notify: (title, body) => {
    if (typeof title === 'string' && typeof body === 'string') {
      ipcRenderer.send('desktop:notify', { title: title.slice(0, 120), body: body.slice(0, 300) })
    }
  },
})
