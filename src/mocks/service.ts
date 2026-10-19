import { HttpResponse } from 'msw'
import type {
  ApiError,
  CartItem,
  Collector,
  Order,
  OrderInput,
  Profile,
  Quote,
  Wallet,
} from '../domain/contracts'
import { discountEth, eth, multiplyEth, subtractEth, sumEth } from '../domain/money'
import { cartFor, getDb, nextId, passwordHash, persist } from './database'

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}
export function failure(status: number, message: string, fields?: Record<string, string>) {
  throw new ServiceError(status, message, fields)
}
export function errorResponse(error: unknown) {
  if (!(error instanceof ServiceError)) {
    console.error(error)
    return HttpResponse.json<ApiError>(
      { code: 'internal', message: 'Falha temporária. Tente novamente.' },
      { status: 500 },
    )
  }
  return HttpResponse.json<ApiError>(
    { code: `http_${error.status}`, message: error.message, fields: error.fields },
    { status: error.status },
  )
}
export function identity(request: Request, required = false, tolerateInvalidToken = false) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const session = getDb().sessions[token]
  const valid = session && session.expiresAt > Date.now()
  // An expired authenticated cart must never silently become a visitor cart.
  // Only session discovery may represent an invalid token as an anonymous user.
  if (!valid && (required || (token && !tolerateInvalidToken)))
    failure(401, 'Sua sessão expirou. Entre novamente para continuar.')
  const userId = valid ? session.userId : null
  return {
    userId,
    token,
    owner: userId ?? `visitor:${request.headers.get('X-Visitor-Id') ?? 'anonymous'}`,
    user: userId ? getDb().users[userId] : null,
    expiresAt: valid ? session.expiresAt : null,
  }
}
export function validate(
  fields: Record<string, string>,
  rules: Record<string, (value: string) => boolean>,
) {
  const errors: Record<string, string> = {}
  for (const [name, test] of Object.entries(rules))
    if (!test(fields[name] ?? '')) errors[name] = 'Confira este campo.'
  if (Object.keys(errors).length) failure(422, 'Revise os campos indicados.', errors)
}
export const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
export const passwordValid = (value: string) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
export async function authenticate(
  request: Request,
  input: Record<string, string>,
  signup: boolean,
) {
  const db = getDb()
  validate(input, {
    email: emailValid,
    password: signup ? passwordValid : (value) => value.length > 0,
    ...(signup ? { name: (value) => value.trim().length >= 2 } : {}),
  })
  let user = Object.values(db.users).find(
    (user) => user.profile.email.toLowerCase() === input.email.toLowerCase(),
  )
  if (signup) {
    if (user)
      failure(409, 'Este e-mail já está cadastrado.', {
        email: 'Utilize outro e-mail ou entre na sua conta.',
      })
    const id = nextId('user')
    user = {
      profile: {
        id,
        name: input.name.trim(),
        email: input.email.toLowerCase(),
        username: input.email.split('@')[0],
        bio: '',
        avatar: '',
      },
      passwordHash: await passwordHash(input.password),
      favorites: [],
      wallets: [],
    }
    db.users[id] = user
  } else if (!user || user.passwordHash !== (await passwordHash(input.password)))
    failure(401, 'E-mail ou senha incorretos.')
  if (!user) failure(401, 'E-mail ou senha incorretos.')
  const activeUser = user!
  const visitor = cartFor(`visitor:${request.headers.get('X-Visitor-Id') ?? 'anonymous'}`)
  const cart = cartFor(activeUser.profile.id)
  for (const item of visitor.items) {
    const existing = cart.items.find(
      (line) => line.nftId === item.nftId && line.editionId === item.editionId,
    )
    const stock =
      db.nfts
        .find((nft) => nft.id === item.nftId)
        ?.editions.find((edition) => edition.id === item.editionId)?.stock ?? 0
    if (existing) existing.quantity = Math.min(stock, existing.quantity + item.quantity)
    else if (stock) cart.items.push({ ...item, quantity: Math.min(stock, item.quantity) })
  }
  if (visitor.coupon && !cart.coupon) cart.coupon = visitor.coupon
  visitor.items = []
  visitor.coupon = ''
  cart.version++
  const token = crypto.randomUUID(),
    expiresAt = Date.now() + 60 * 60 * 1000
  db.sessions[token] = { userId: activeUser.profile.id, expiresAt }
  persist()
  return { token, user: activeUser.profile, expiresAt }
}
export function checkItem(item: CartItem) {
  const nft = getDb().nfts.find((nft) => nft.id === item.nftId)
  if (!nft) failure(404, 'NFT não encontrado.')
  const edition = nft!.editions.find((edition) => edition.id === item.editionId)
  if (!edition) failure(404, 'Edição não encontrada.')
  if (!Number.isInteger(item.quantity) || item.quantity < 1)
    failure(422, 'A quantidade deve ser um número inteiro positivo.')
  if (item.quantity > edition!.stock)
    failure(409, `Disponibilidade alterada: ${edition!.stock} unidade(s).`)
  return { nft: nft!, edition: edition! }
}
export function quoteFor(owner: string, network = 'Ethereum', coupon?: string): Quote {
  const db = getDb(),
    cart = cartFor(owner)
  const code = (coupon ?? cart.coupon).trim().toUpperCase()
  if (code === 'EXPIRED' || (code && db.scenario.couponExpired))
    failure(422, 'Este cupom expirou.', { coupon: 'Cupom expirado.' })
  if (code && code !== 'KURIO10')
    failure(422, 'Cupom inválido.', { coupon: 'Utilize KURIO10 para 10% de desconto.' })
  const lines = cart.items.map((item) => {
    const { nft, edition } = checkItem(item)
    return {
      ...item,
      name: nft.name,
      image: nft.image,
      edition: edition.name,
      unitPrice: nft.price,
      total: multiplyEth(nft.price, item.quantity),
      available: edition.stock,
    }
  })
  const subtotal = sumEth(lines.map((line) => line.total)),
    discount = discountEth(subtotal, code ? '0.10' : '0')
  const fee = eth(
    lines.length ? (db.scenario.networkFee ?? (network === 'Polygon' ? '0.0001' : '0.0025')) : '0',
  )
  const fingerprint = JSON.stringify({ lines, coupon: code, fee, network })
  const quote: Quote = {
    id: nextId('quote'),
    expiresAt: Date.now() + 5 * 60_000,
    lines,
    subtotal,
    discount,
    fee,
    total: sumEth([subtractEth(subtotal, discount), fee]),
    coupon: code,
    fingerprint,
  }
  db.quotes[quote.id] = quote
  db.quoteOwners[quote.id] = owner
  for (const [id, previous] of Object.entries(db.quotes)) {
    if (!previous.expiresAt || previous.expiresAt < Date.now()) {
      delete db.quotes[id]
      delete db.quoteOwners[id]
    }
  }
  persist()
  return quote
}
export function validateCollector(collector: Collector) {
  validate(collector as unknown as Record<string, string>, {
    name: (value) => value.trim().length >= 3,
    email: emailValid,
    username: (value) => /^[\w]{3,24}$/.test(value),
    profileName: (value) => value.trim().length >= 2,
    walletAddress: (value) => /^0x[\da-fA-F]{40}$/.test(value),
    secondaryAddress: (value) =>
      !value || /^0x[\da-fA-F]{40}$/.test(value) || /^[\w-]+\.eth$/.test(value),
    walletType: (value) => ['MetaMask', 'WalletConnect', 'Coinbase Wallet'].includes(value),
    referral: (value) => /^[\w-]{3,30}$/.test(value),
    ens: (value) => /^[\w-]{3,30}\.eth$/.test(value),
    note: (value) => value.length <= 1000,
  })
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    .join(',')}}`
}
export function createOrder(userId: string, key: string, input: OrderInput): Order {
  const db = getDb()
  if (!key || key.length > 128) failure(422, 'Chave de idempotência obrigatória.')
  const attemptId = `${userId}:${key}`,
    payload = canonical(input),
    previous = db.attempts[attemptId]
  if (previous) {
    if (previous.payload !== payload)
      failure(409, 'Esta tentativa já foi usada com outro conteúdo.')
    return settleOrder(db.orders[previous.orderId])
  }
  validateCollector(input.collector)
  const wallet = db.users[userId].wallets.find((wallet) => wallet.id === input.walletId)
  if (!wallet || wallet.network !== input.network)
    failure(422, 'Selecione uma carteira da rede escolhida.')
  if (input.collector.walletAddress.toLowerCase() !== wallet!.address.toLowerCase())
    failure(422, 'O endereço não corresponde à carteira escolhida.', {
      walletAddress: 'Selecione novamente sua carteira.',
    })
  const quoted = db.quotes[input.quoteId]
  if (!quoted || quoted.expiresAt < Date.now() || db.quoteOwners[input.quoteId] !== userId)
    failure(409, 'Cotação expirada. Revise novamente os valores.')
  const fresh = quoteFor(userId, input.network)
  if (!fresh.lines.length) failure(409, 'Seu carrinho está vazio.')
  if (fresh.fingerprint !== quoted.fingerprint)
    failure(409, 'Os valores ou a disponibilidade mudaram. Revise e confirme novamente.')
  const id = nextId('order')
  const order: Order = {
    id,
    userId,
    status: 'pending',
    version: 1,
    quote: structuredClone(quoted),
    collector: structuredClone(input.collector),
    wallet: structuredClone(wallet!),
    transaction: `0x${id.replace(/\D/g, '').padStart(64, '0')}`,
    createdAt: Date.now(),
    resolveAt: Date.now() + db.scenario.orderDelay,
    outcome: db.scenario.payment,
  }
  db.orders[id] = order
  db.attempts[attemptId] = { payload, orderId: id }
  persist()
  return order
}
export function settleOrder(order: Order): Order {
  if (order.status !== 'pending' || Date.now() < order.resolveAt) return order
  const db = getDb()
  // Inventory is checked again atomically at settlement; terminal states cannot regress.
  const available = order.quote.lines.every(
    (line) =>
      (db.nfts
        .find((nft) => nft.id === line.nftId)
        ?.editions.find((edition) => edition.id === line.editionId)?.stock ?? 0) >= line.quantity,
  )
  order.status = available ? order.outcome : 'declined'
  order.version++
  if (order.status === 'confirmed') {
    const cart = cartFor(order.userId)
    for (const line of order.quote.lines) {
      const nft = db.nfts.find((nft) => nft.id === line.nftId)!,
        edition = nft.editions.find((edition) => edition.id === line.editionId)!
      edition.stock -= line.quantity
      nft.version++
      const remaining = cart.items.find(
        (item) => item.nftId === line.nftId && item.editionId === line.editionId,
      )
      if (remaining) remaining.quantity = Math.max(0, remaining.quantity - line.quantity)
    }
    cart.items = cart.items.filter((item) => item.quantity > 0)
    cart.version++
    if (!cart.items.length) cart.coupon = ''
  }
  persist()
  return order
}
export function updateProfile(userId: string, input: Partial<Profile>) {
  const user = getDb().users[userId],
    merged = { ...user.profile, ...input, id: userId }
  validate(merged as unknown as Record<string, string>, {
    name: (value) => value.trim().length >= 2,
    email: emailValid,
    username: (value) => /^[a-zA-Z0-9_]{3,24}$/.test(value),
    bio: (value) => value.length <= 300,
  })
  if (merged.ens && !/^[\w-]{3,30}\.eth$/.test(merged.ens))
    failure(422, 'Nome ENS inválido.', { ens: 'Use um nome terminado em .eth.' })
  if (
    Object.values(getDb().users).some(
      (other) =>
        other.profile.id !== userId &&
        other.profile.email.toLowerCase() === merged.email.toLowerCase(),
    )
  )
    failure(409, 'E-mail já utilizado.', { email: 'Este e-mail pertence a outra conta.' })
  if (
    merged.avatar &&
    !merged.avatar.startsWith('/images/') &&
    !/^data:image\/(png|jpeg|webp);base64,/.test(merged.avatar)
  )
    failure(422, 'Formato de avatar inválido.')
  if (merged.avatar.length > 400_000) failure(422, 'O avatar deve ter até 300 KB.')
  user.profile = merged
  persist()
  return merged
}
export function saveWallet(userId: string, input: Wallet, id?: string) {
  const wallets = getDb().users[userId].wallets
  validate(input as unknown as Record<string, string>, {
    name: (value) => value.trim().length >= 2 && value.length <= 50,
    address: (value) => /^0x[\da-fA-F]{40}$/.test(value),
    network: (value) => ['Ethereum', 'Polygon'].includes(value),
    displayName: (value) => value.trim().length >= 2,
    profileName: (value) => value.trim().length >= 2,
    type: (value) => ['MetaMask', 'WalletConnect', 'Coinbase Wallet'].includes(value),
    referral: (value) => /^[\w-]{3,30}$/.test(value),
    email: emailValid,
    ens: (value) => /^[\w-]{3,30}\.eth$/.test(value),
    secondaryAddress: (value) =>
      !value || /^0x[\da-fA-F]{40}$/.test(value) || /^[\w-]+\.eth$/.test(value),
  })
  if (id && !wallets.some((wallet) => wallet.id === id)) failure(404, 'Carteira não encontrada.')
  if (
    wallets.some(
      (wallet) =>
        wallet.id !== id &&
        wallet.address.toLowerCase() === input.address.toLowerCase() &&
        wallet.network === input.network,
    )
  )
    failure(409, 'Esta carteira já está cadastrada.')
  const wallet = {
    ...input,
    id: id ?? nextId('wallet'),
    primary: input.primary || !wallets.some((other) => other.id !== id && other.primary),
  }
  if (wallet.primary)
    wallets.forEach((other) => {
      other.primary = false
    })
  if (id)
    wallets.splice(
      wallets.findIndex((other) => other.id === id),
      1,
      wallet,
    )
  else wallets.push(wallet)
  persist()
  return wallet
}
