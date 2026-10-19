import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import type {
  Cart,
  Nft,
  NftEvent,
  OrderEvent,
  Order,
  Profile,
  Quote,
  Session,
  Wallet,
} from '../domain/contracts'
import { api, errorMessage, statusOf } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) =>
        count < 1 && ![401, 403, 404, 409, 422].includes(statusOf(error) ?? 0),
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})
const SessionContext = createContext<{
  user: Profile | null
  loading: boolean
  establish: (token: string) => Promise<void>
  logout: () => Promise<void>
  notice: (message: string) => void
  connected: boolean
}>({
  user: null,
  loading: true,
  establish: async () => {},
  logout: async () => {},
  notice: () => {},
  connected: false,
})
export const useSession = () => useContext(SessionContext)
export function AppState({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => (await api.get<Session>('/session', { signal })).data,
    staleTime: 0,
    refetchInterval: 30_000,
  })
  const [message, setMessage] = useState(''),
    [connected, setConnected] = useState(false)
  const user = session.data?.user ?? null
  const lastUser = useRef<string | null>(null)
  const epoch = useRef(0)
  const notice = (value: string) => setMessage(value)
  useEffect(() => {
    if (lastUser.current && lastUser.current !== user?.id) {
      void queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    }
    lastUser.current = user?.id ?? null
  }, [user?.id])
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        const activeToken = localStorage.getItem('kurio.session')
        if (
          statusOf(error) === 401 &&
          !error.config?.url?.includes('/session/login') &&
          activeToken &&
          error.config?.headers?.Authorization === `Bearer ${activeToken}`
        ) {
          localStorage.removeItem('kurio.session')
          void queryClient.invalidateQueries({ queryKey: ['session'] })
          setMessage('Sessão expirada. Entre novamente para retomar o fluxo.')
        }
        return Promise.reject(error)
      },
    )
    return () => api.interceptors.response.eject(interceptor)
  }, [])
  useEffect(() => {
    const currentEpoch = ++epoch.current,
      token = localStorage.getItem('kurio.session') ?? ''
    const seen = new Map<string, number>(),
      eventIds = new Set<string>()
    let liveSocket: Socket | undefined
    let disposed = false
    const startSocket = async () => {
      const { io } = await import('socket.io-client')
      if (disposed) return
      const socket = io('wss://jungle-nft.test', {
        transports: ['websocket'],
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
      })
      liveSocket = socket
      const current = () =>
        epoch.current === currentEpoch && (localStorage.getItem('kurio.session') ?? '') === token
      const accept = (event: NftEvent | OrderEvent, kind: string) => {
        const knownVersion =
          kind === 'nft'
            ? (queryClient.getQueryData<Nft>(['nft', event.resourceId])?.version ?? 0)
            : (queryClient.getQueryData<Order>(['order', user?.id, event.resourceId])?.version ?? 0)
        if (
          !current() ||
          eventIds.has(event.eventId) ||
          event.version < knownVersion ||
          event.version <= (seen.get(`${kind}:${event.resourceId}`) ?? 0)
        )
          return false
        if (event.userId && (event.userId !== user?.id || event.sessionId !== token)) return false
        eventIds.add(event.eventId)
        seen.set(`${kind}:${event.resourceId}`, event.version)
        if (eventIds.size > 1000) eventIds.delete(eventIds.values().next().value!)
        return true
      }
      socket.on('connect', () => {
        if (!current()) return
        setConnected(true)
        socket.emit('session.subscribe', { token })
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== 'session' && query.state.data !== undefined,
        })
      })
      socket.on('disconnect', () => {
        if (current()) setConnected(false)
      })
      socket.on('nft.updated', (event: NftEvent) => {
        if (!accept(event, 'nft')) return
        setMessage('Preço ou disponibilidade atualizados. Confira os valores antes de comprar.')
        void queryClient.invalidateQueries({
          predicate: (query) =>
            ['catalog', 'nft', 'cart', 'quote'].includes(String(query.queryKey[0])),
        })
      })
      socket.on('order.updated', (event: OrderEvent) => {
        if (!accept(event, 'order')) return
        setMessage(
          event.order.status === 'confirmed'
            ? 'Pedido confirmado na simulação.'
            : event.order.status === 'declined'
              ? 'Pagamento recusado. Seu carrinho foi preservado.'
              : 'Pedido atualizado.',
        )
        void queryClient.invalidateQueries({
          predicate: (query) =>
            ['order', 'orders', 'cart', 'quote', 'catalog', 'nft'].includes(
              String(query.queryKey[0]),
            ),
        })
      })
    }
    void startSocket()
    return () => {
      disposed = true
      epoch.current++
      liveSocket?.removeAllListeners()
      liveSocket?.disconnect()
      setConnected(false)
    }
  }, [user?.id, session.data?.expiresAt])
  async function establish(token: string) {
    await queryClient.cancelQueries()
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    localStorage.setItem('kurio.session', token)
    const response = await api.get<Session>('/session')
    queryClient.setQueryData<Session>(['session'], response.data)
  }
  async function logout() {
    try {
      await api.post('/session/logout')
    } finally {
      localStorage.removeItem('kurio.session')
      epoch.current++
      await queryClient.cancelQueries()
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
      queryClient.setQueryData<Session>(['session'], { user: null, expiresAt: null })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      setMessage('Você saiu da conta.')
    }
  }
  return (
    <SessionContext
      value={{ user, loading: session.isPending, establish, logout, notice, connected }}
    >
      {children}
      <div className="toast" role="status" aria-live="polite">
        {message && (
          <>
            <span>{message}</span>
            <button onClick={() => setMessage('')} aria-label="Fechar notificação">
              ×
            </button>
          </>
        )}
      </div>
    </SessionContext>
  )
}
export function usePrivateQuery<T>(resource: string, enabled = true) {
  const { user } = useSession()
  return useQuery({
    queryKey: [resource, user?.id ?? 'visitor'],
    queryFn: async ({ signal }) => (await api.get<T>(`/${resource}`, { signal })).data,
    enabled: enabled && (['cart'].includes(resource) || !!user),
  })
}
export const useCart = () => usePrivateQuery<Cart>('cart')
export const useWallets = () => usePrivateQuery<Wallet[]>('wallets')
export function useQuote(network = 'Ethereum') {
  const { user } = useSession(),
    cart = useCart()
  return useQuery({
    queryKey: ['quote', user?.id ?? 'visitor', cart.data?.version, network],
    queryFn: async ({ signal }) => (await api.post<Quote>('/quote', { network }, { signal })).data,
    enabled: !!cart.data,
  })
}
export function useApiMutation<TInput = void, TOutput = unknown>(
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string | ((input: TInput) => string),
  resources: string[],
  success?: string,
) {
  const client = useQueryClient(),
    { notice } = useSession()
  return useMutation({
    mutationFn: async (input: TInput) =>
      (
        await api.request<TOutput>({
          method,
          url: typeof path === 'function' ? path(input) : path,
          data: input,
        })
      ).data,
    onSuccess: async () => {
      await Promise.all(
        resources.map((resource) => client.invalidateQueries({ queryKey: [resource] })),
      )
      if (success) notice(success)
    },
    onError: (error) => notice(errorMessage(error)),
  })
}
