import { delay, http, HttpResponse, ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import Decimal from 'decimal.js'
import type {
  CartItem,
  NftEvent,
  OrderEvent,
  OrderInput,
  Profile,
  Scenario,
  Wallet,
} from '../domain/contracts'
import { cartFor, defaultScenario, getDb, passwordHash, persist, resetDatabase } from './database'
import {
  authenticate,
  checkItem,
  createOrder,
  errorResponse,
  failure,
  identity,
  passwordValid,
  quoteFor,
  saveWallet,
  settleOrder,
  updateProfile,
} from './service'

type SocketPeer = ReturnType<typeof toSocketIo>
const peers = new Set<{ socket: SocketPeer; token: string }>()
function broadcastNft(event: NftEvent) {
  for (const peer of peers) peer.socket.client.emit('nft.updated', event)
}
function broadcastOrder(order: ReturnType<typeof settleOrder>) {
  for (const peer of peers) {
    const session = getDb().sessions[peer.token]
    if (session?.userId === order.userId && session.expiresAt > Date.now()) {
      const event: OrderEvent = {
        eventId: `${order.id}:${order.version}`,
        resourceId: order.id,
        version: order.version,
        userId: order.userId,
        sessionId: peer.token,
        order,
      }
      peer.socket.client.emit('order.updated', event)
    }
  }
}
function scheduleSettlement(orderId: string) {
  const order = getDb().orders[orderId]
  if (!order || order.status !== 'pending') return
  setTimeout(
    () => {
      const current = getDb().orders[orderId]
      if (!current || current.status !== 'pending') return
      const settled = settleOrder(current)
      broadcastOrder(settled)
      if (settled.status === 'confirmed')
        for (const line of settled.quote.lines) {
          const nft = getDb().nfts.find((nft) => nft.id === line.nftId)!
          broadcastNft({
            eventId: `${nft.id}:${nft.version}`,
            resourceId: nft.id,
            version: nft.version,
            nft,
          })
        }
    },
    Math.max(0, order.resolveAt - Date.now()),
  )
}
const socketLink = ws.link('wss://jungle-nft.test')
export const socketHandler = socketLink.addEventListener('connection', (connection) => {
  const socket = toSocketIo(connection)
  const peer = { socket, token: '' }
  peers.add(peer)
  socket.client.on('session.subscribe', (_event, payload: { token?: string }) => {
    peer.token = payload?.token ?? ''
    const session = getDb().sessions[peer.token]
    socket.client.emit('session.ready', { authenticated: !!session, sessionId: peer.token })
    if (session)
      for (const order of Object.values(getDb().orders).filter(
        (order) => order.userId === session.userId,
      )) {
        const before = order.version
        settleOrder(order)
        if (order.version !== before) broadcastOrder(order)
        scheduleSettlement(order.id)
      }
  })
  connection.client.addEventListener('close', () => peers.delete(peer))
})

type Handler = (
  request: Request,
  params: Record<string, string | readonly string[] | undefined>,
) => unknown | Promise<unknown>
function endpoint(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  handler: Handler,
) {
  return http[method](`/api${path}`, async ({ request, params }) => {
    try {
      const scenario = getDb().scenario
      if (!path.startsWith('/demo')) {
        const url = new URL(request.url)
        await delay(
          scenario.variableLatency
            ? url.searchParams.get('q')?.length === 1
              ? 1000
              : 80
            : scenario.latency,
        )
        if (scenario.offline) return HttpResponse.error()
        if (
          scenario.failNext &&
          `${method.toUpperCase()} ${url.pathname}`.includes(scenario.failNext)
        ) {
          const status = scenario.status
          scenario.failNext = ''
          persist()
          failure(status, 'Falha simulada. Tente novamente.')
        }
      }
      const value = await handler(request, params)
      return value instanceof Response ? value : HttpResponse.json(value ?? { ok: true })
    } catch (error) {
      return errorResponse(error)
    }
  })
}
const body = async <T>(request: Request) => (await request.json()) as T
export const handlers = [
  endpoint('get', '/session', (request) => {
    const auth = identity(request, false, true)
    return { user: auth.user?.profile ?? null, expiresAt: auth.expiresAt }
  }),
  endpoint('post', '/session/login', async (request) =>
    authenticate(request, await body(request), false),
  ),
  endpoint('post', '/session/register', async (request) =>
    authenticate(request, await body(request), true),
  ),
  endpoint('post', '/session/logout', (request) => {
    const { token } = identity(request)
    delete getDb().sessions[token]
    persist()
  }),
  endpoint('post', '/session/expire', (request) => {
    const { token } = identity(request, true)
    getDb().sessions[token].expiresAt = 0
    persist()
  }),
  endpoint('get', '/nfts', (request) => {
    const params = new URL(request.url).searchParams,
      q = (params.get('q') ?? '').toLowerCase()
    let items = getDb().scenario.empty
      ? []
      : getDb().nfts.filter((nft) =>
          `${nft.name} ${nft.creator} ${nft.collection}`.toLowerCase().includes(q),
        )
    for (const field of ['category', 'collection', 'network'] as const)
      if (params.get(field)) items = items.filter((nft) => nft[field] === params.get(field))
    for (const field of ['minPrice', 'maxPrice'])
      if (params.get(field)) {
        const value = params.get(field)!
        if (!/^\d+(\.\d{1,18})?$/.test(value)) failure(422, 'Faixa de preço inválida.')
        items = items.filter((nft) =>
          field === 'minPrice'
            ? new Decimal(nft.price).gte(value)
            : new Decimal(nft.price).lte(value),
        )
      }
    const sort = params.get('sort')
    if (sort === 'price-asc' || sort === 'price-desc')
      items = [...items].sort(
        (a, b) => new Decimal(a.price).comparedTo(b.price) * (sort === 'price-asc' ? 1 : -1),
      )
    if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name))
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1),
      size = 9
    const facets = {
      categories: {} as Record<string, number>,
      networks: {} as Record<string, number>,
    }
    for (const nft of getDb().nfts) {
      facets.categories[nft.category] = (facets.categories[nft.category] ?? 0) + 1
      facets.networks[nft.network] = (facets.networks[nft.network] ?? 0) + 1
    }
    return {
      items: items.slice((page - 1) * size, page * size),
      total: items.length,
      page,
      pages: Math.ceil(items.length / size),
      facets,
    }
  }),
  endpoint('get', '/nfts/:id', (_request, { id }) => {
    const nft = getDb().nfts.find((nft) => nft.id === id)
    if (!nft) failure(404, 'NFT não encontrado.')
    return nft
  }),
  endpoint('get', '/favorites', (request) => identity(request, true).user!.favorites),
  endpoint('put', '/favorites/:id', (request, { id }) => {
    const { user } = identity(request, true)
    if (!getDb().nfts.some((nft) => nft.id === id)) failure(404, 'NFT não encontrado.')
    if (!user!.favorites.includes(String(id))) user!.favorites.push(String(id))
    persist()
    return user!.favorites
  }),
  endpoint('delete', '/favorites/:id', (request, { id }) => {
    const { user } = identity(request, true)
    user!.favorites = user!.favorites.filter((favorite) => favorite !== id)
    persist()
    return user!.favorites
  }),
  endpoint('get', '/cart', (request) => cartFor(identity(request).owner)),
  endpoint('post', '/cart/items', async (request) => {
    const cart = cartFor(identity(request).owner),
      item = await body<CartItem>(request)
    const existing = cart.items.find(
      (line) => line.nftId === item.nftId && line.editionId === item.editionId,
    )
    checkItem({ ...item, quantity: item.quantity + (existing?.quantity ?? 0) })
    if (existing) existing.quantity += item.quantity
    else cart.items.push(item)
    cart.version++
    persist()
    return cart
  }),
  endpoint('patch', '/cart/items/:nftId/:editionId', async (request, params) => {
    const cart = cartFor(identity(request).owner),
      input = await body<{ quantity: number }>(request)
    const item = cart.items.find(
      (line) => line.nftId === params.nftId && line.editionId === params.editionId,
    )
    if (!item) failure(404, 'Item não encontrado.')
    checkItem({ ...item!, quantity: input.quantity })
    item!.quantity = input.quantity
    cart.version++
    persist()
    return cart
  }),
  endpoint('delete', '/cart/items/:nftId/:editionId', (request, params) => {
    const cart = cartFor(identity(request).owner)
    cart.items = cart.items.filter(
      (line) => line.nftId !== params.nftId || line.editionId !== params.editionId,
    )
    cart.version++
    persist()
    return cart
  }),
  endpoint('post', '/quote', async (request) => {
    const input = await body<{ network?: string; coupon?: string }>(request)
    return quoteFor(identity(request).owner, input.network, input.coupon)
  }),
  endpoint('put', '/cart/coupon', async (request) => {
    const owner = identity(request).owner,
      { coupon } = await body<{ coupon: string }>(request)
    quoteFor(owner, 'Ethereum', coupon)
    const cart = cartFor(owner)
    cart.coupon = coupon.trim().toUpperCase()
    cart.version++
    persist()
    return cart
  }),
  endpoint('delete', '/cart/coupon', (request) => {
    const cart = cartFor(identity(request).owner)
    cart.coupon = ''
    cart.version++
    persist()
    return cart
  }),
  endpoint('post', '/orders', async (request) => {
    const { userId } = identity(request, true),
      input = await body<OrderInput>(request)
    const order = createOrder(userId!, request.headers.get('Idempotency-Key') ?? '', input)
    scheduleSettlement(order.id)
    if (getDb().scenario.timeoutAfterCreate) {
      getDb().scenario.timeoutAfterCreate = false
      persist()
      await delay(10_000)
    }
    return order
  }),
  endpoint('get', '/orders', (request) => {
    const { userId } = identity(request, true)
    return Object.values(getDb().orders)
      .filter((order) => order.userId === userId)
      .map(settleOrder)
  }),
  endpoint('get', '/orders/:id', (request, { id }) => {
    const { userId } = identity(request, true),
      order = getDb().orders[String(id)]
    if (!order) failure(404, 'Pedido não encontrado.')
    if (order.userId !== userId) failure(403, 'Este pedido pertence a outro colecionador.')
    const result = settleOrder(order)
    scheduleSettlement(order.id)
    return result
  }),
  endpoint('get', '/profile', (request) => identity(request, true).user!.profile),
  endpoint('patch', '/profile', async (request) =>
    updateProfile(identity(request, true).userId!, await body<Partial<Profile>>(request)),
  ),
  endpoint('put', '/profile/password', async (request) => {
    const { user } = identity(request, true),
      input = await body<{ currentPassword: string; password: string }>(request)
    if (user!.passwordHash !== (await passwordHash(input.currentPassword)))
      failure(422, 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' })
    if (!passwordValid(input.password))
      failure(422, 'A senha precisa de 8 caracteres, maiúscula, minúscula e número.', {
        password: 'Escolha uma senha mais forte.',
      })
    user!.passwordHash = await passwordHash(input.password)
    persist()
  }),
  endpoint('get', '/wallets', (request) => identity(request, true).user!.wallets),
  endpoint('post', '/wallets', async (request) =>
    saveWallet(identity(request, true).userId!, await body<Wallet>(request)),
  ),
  endpoint('put', '/wallets/:id', async (request, { id }) =>
    saveWallet(identity(request, true).userId!, await body<Wallet>(request), String(id)),
  ),
  endpoint('post', '/wallets/:id/connection', async (request, { id }) => {
    const { user } = identity(request, true),
      input = await body<{ action: 'connect' | 'decline' | 'disconnect' }>(request)
    if (!user!.wallets.some((wallet) => wallet.id === id)) failure(404, 'Carteira não encontrada.')
    if (input.action === 'decline')
      failure(409, 'Conexão recusada na simulação. Você pode tentar novamente.')
    return { walletId: id, connected: input.action === 'connect' }
  }),
  // Scenario controls are a documented network API of this local demonstration, never production APIs.
  endpoint('get', '/demo', () => ({ scenario: getDb().scenario, defaults: defaultScenario })),
  endpoint('post', '/demo/reset', async (request) => {
    for (const peer of peers) peer.socket.rawClient.close()
    peers.clear()
    await resetDatabase(await body<Partial<Scenario>>(request))
    return { ok: true }
  }),
  endpoint('patch', '/demo', async (request) => {
    Object.assign(getDb().scenario, await body<Partial<Scenario>>(request))
    persist()
    return getDb().scenario
  }),
  endpoint('post', '/demo/nft', async (request) => {
    const input = await body<{
      id: string
      price?: string
      stock?: number
      duplicate?: boolean
      old?: boolean
    }>(request)
    const source = getDb().nfts.find((nft) => nft.id === input.id)
    const nft = input.old ? structuredClone(source) : source
    if (!nft) failure(404, 'NFT não encontrado.')
    if (input.price !== undefined) {
      if (!/^\d+(\.\d{1,18})?$/.test(input.price)) failure(422, 'Preço inválido.')
      nft!.price = new Decimal(input.price).toFixed(18)
    }
    if (input.stock !== undefined) {
      if (!Number.isInteger(input.stock) || input.stock < 0) failure(422, 'Estoque inválido.')
      nft!.editions[0].stock = input.stock
    }
    nft!.version += input.old ? -1 : 1
    persist()
    const event: NftEvent = {
      eventId: `nft:${nft!.id}:${nft!.version}`,
      resourceId: nft!.id,
      version: nft!.version,
      nft: structuredClone(nft!),
    }
    broadcastNft(event)
    if (input.duplicate) broadcastNft(event)
    return nft
  }),
  endpoint('post', '/demo/disconnect', () => {
    for (const peer of peers) peer.socket.rawClient.close()
    peers.clear()
  }),
  endpoint('post', '/demo/settle', () => {
    for (const order of Object.values(getDb().orders)) {
      if (order.status === 'pending') order.resolveAt = Date.now()
      settleOrder(order)
      broadcastOrder(order)
    }
    persist()
  }),
  endpoint('post', '/demo/order-event', async (request) => {
    const input = await body<{ id: string; old?: boolean; duplicate?: boolean }>(request),
      order = getDb().orders[input.id]
    if (!order) failure(404, 'Pedido não encontrado.')
    const snapshot = structuredClone(order)
    if (input.old) {
      snapshot.version = Math.max(0, snapshot.version - 1)
      snapshot.status = 'pending'
    }
    broadcastOrder(snapshot)
    if (input.duplicate) broadcastOrder(snapshot)
  }),
]
