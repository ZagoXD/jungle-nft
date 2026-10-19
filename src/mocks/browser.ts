import { setupWorker } from 'msw/browser'
import { handlers, socketHandler } from './handlers'
import { initializeDatabase } from './database'

export async function startMocks() {
  await initializeDatabase()
  // MSW unregisters its worker when the previous document closes. On rapid
  // reloads, reusing that registration races its pending removal and causes an
  // unhandled registration.update() rejection in MSW 2.15. Start a fresh owned
  // registration; never unregister workers belonging to another application.
  const workerUrl = new URL('/mockServiceWorker.js', location.origin).href
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    const script = registration.active?.scriptURL ?? registration.waiting?.scriptURL
    if (script === workerUrl) await registration.unregister()
  }
  const worker = setupWorker(...handlers, socketHandler)
  await worker.start({ quiet: true, onUnhandledRequest: 'bypass' })
  return worker
}
