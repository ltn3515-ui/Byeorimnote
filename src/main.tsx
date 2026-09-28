import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })
      await navigator.serviceWorker.ready
      registration.update().catch(() => undefined)
      window.dispatchEvent(new CustomEvent('byeorim-sw-ready'))
    } catch (error) {
      console.error('[Byeorim Note] Service worker registration failed', error)
      window.dispatchEvent(new CustomEvent('byeorim-sw-error'))
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
