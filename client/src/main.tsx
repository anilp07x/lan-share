import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

const el = document.getElementById('root')
if (!el) throw new Error('#root não encontrado')

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: só em contexto seguro (http LAN é seguro) e só em navegadores com suporte.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}