import { Protected } from './components/protected'
import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { safeNext } from './lib/navigation'
import { validateCatalogSearch } from './lib/catalogSearch'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { AppState, queryClient } from './lib/state'
import { ErrorState, Layout, Skeleton } from './components/shared'
import { api } from './lib/api'
import type { Session } from './domain/contracts'

const CatalogPage = lazy(() =>
  import('./pages/catalog').then((page) => ({ default: page.CatalogPage })),
)
const DetailPage = lazy(() =>
  import('./pages/detail').then((page) => ({ default: page.DetailPage })),
)
const AuthPage = lazy(() => import('./pages/auth').then((page) => ({ default: page.AuthPage })))
const CartPage = lazy(() => import('./pages/cart').then((page) => ({ default: page.CartPage })))
const ProfilePage = lazy(() =>
  import('./pages/account').then((page) => ({ default: page.ProfilePage })),
)
const WalletsPage = lazy(() =>
  import('./pages/account').then((page) => ({ default: page.WalletsPage })),
)
const CheckoutPage = lazy(() =>
  import('./pages/checkout').then((page) => ({ default: page.CheckoutPage })),
)
const ExplorerPage = lazy(() =>
  import('./pages/orders').then((page) => ({ default: page.ExplorerPage })),
)
const FavoritesPage = lazy(() =>
  import('./pages/orders').then((page) => ({ default: page.FavoritesPage })),
)
const OrderPage = lazy(() => import('./pages/orders').then((page) => ({ default: page.OrderPage })))
const OrdersPage = lazy(() =>
  import('./pages/orders').then((page) => ({ default: page.OrdersPage })),
)
const DemoPage = lazy(() => import('./pages/demo').then((page) => ({ default: page.DemoPage })))

const root = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
  pendingComponent: () => <Skeleton type="detail" />,
  errorComponent: ({ error, reset }) => <ErrorState error={error} retry={reset} />,
  notFoundComponent: () => (
    <section className="state-box">
      <h1>Página não encontrada</h1>
      <a href="/">Voltar ao início</a>
    </section>
  ),
})
const home = createRoute({
  getParentRoute: () => root,
  path: '/',
  validateSearch: validateCatalogSearch,
  component: CatalogPage,
})
const detail = createRoute({ getParentRoute: () => root, path: '/nft/$id', component: DetailPage })
const login = createRoute({
  getParentRoute: () => root,
  path: '/login',
  validateSearch: (raw: Record<string, unknown>) => ({ next: safeNext(raw.next) }),
  component: AuthPage,
})
const signup = createRoute({
  getParentRoute: () => root,
  path: '/cadastro',
  validateSearch: (raw: Record<string, unknown>) => ({ next: safeNext(raw.next) }),
  component: AuthPage,
})
const guard = async ({ location }: { location: { href: string } }) => {
  const token = localStorage.getItem('kurio.session')
  const session = (await api.get<Session>('/session')).data
  if (token !== localStorage.getItem('kurio.session'))
    throw redirect({ to: '/login', search: { next: location.href } })
  queryClient.setQueryData<Session>(['session'], session)
  if (!session.user) throw redirect({ to: '/login', search: { next: location.href } })
}
const cart = createRoute({ getParentRoute: () => root, path: '/carrinho', component: CartPage })
const profile = createRoute({
  getParentRoute: () => root,
  path: '/perfil',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <ProfilePage />
    </Protected>
  ),
})
const wallets = createRoute({
  getParentRoute: () => root,
  path: '/carteiras',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <WalletsPage />
    </Protected>
  ),
})
const checkout = createRoute({
  getParentRoute: () => root,
  path: '/pagamento',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <CheckoutPage />
    </Protected>
  ),
})
const order = createRoute({
  getParentRoute: () => root,
  path: '/pedido/$id',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <OrderPage />
    </Protected>
  ),
})
const orders = createRoute({
  getParentRoute: () => root,
  path: '/pedidos',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <OrdersPage />
    </Protected>
  ),
})
const favorites = createRoute({
  getParentRoute: () => root,
  path: '/favoritos',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <FavoritesPage />
    </Protected>
  ),
})
const explorer = createRoute({
  getParentRoute: () => root,
  path: '/explorador/$id',
  beforeLoad: guard,
  component: () => (
    <Protected>
      <ExplorerPage />
    </Protected>
  ),
})
const demo = createRoute({ getParentRoute: () => root, path: '/demonstracao', component: DemoPage })
const router = createRouter({
  defaultPreload: 'intent',
  routeTree: root.addChildren([
    home,
    detail,
    login,
    signup,
    cart,
    profile,
    wallets,
    checkout,
    order,
    orders,
    favorites,
    explorer,
    demo,
  ]),
})
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppState>
        <RouterProvider router={router} />
      </AppState>
    </QueryClientProvider>
  )
}
export function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
