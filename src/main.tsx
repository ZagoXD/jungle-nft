import './styles.css'

async function bootstrap() {
  const application = import('./app')
  // Fetch the requested discovery route while the local mock service starts.
  // Route modules only declare components; API calls still wait for MSW.
  const discoveryRoute =
    location.pathname === '/'
      ? import('./pages/catalog')
      : location.pathname.startsWith('/nft/')
        ? import('./pages/detail')
        : Promise.resolve()
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  // Import socket.io-client only after MSW installs its WebSocket interceptor.
  const [{ mountApp }] = await Promise.all([application, discoveryRoute])
  mountApp()
}
bootstrap().catch((error) => {
  console.error(error)
  document.getElementById('root')!.textContent =
    'Não foi possível iniciar a aplicação. Recarregue a página.'
})
