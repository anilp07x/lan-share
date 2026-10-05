'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lanShare', {
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (handler) => {
    const listener = (_event, next) => handler(next)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
  openBrowser: () => ipcRenderer.invoke('open:browser'),
  openFolder: () => ipcRenderer.invoke('open:folder'),
  copy: (text) => ipcRenderer.invoke('copy:text', text),
  restart: () => ipcRenderer.invoke('server:restart'),
  hide: () => ipcRenderer.invoke('panel:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', enabled),
})