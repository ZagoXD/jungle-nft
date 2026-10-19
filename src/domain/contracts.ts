/** All ETH values cross the network as decimal strings. Never coerce them to Number. */
export type Eth = string
export type Network = 'Ethereum' | 'Polygon'
export interface Edition {
  id: string
  name: string
  stock: number
}
export interface Nft {
  id: string
  name: string
  collection: string
  creator: string
  category: string
  price: Eth
  image: string
  gallery: string[]
  description: string
  editions: Edition[]
  version: number
  network: Network
}
export interface CatalogSearch {
  q: string
  category: string
  collection: string
  network: string
  sort: string
  page: number
  minPrice: string
  maxPrice: string
}
export interface Catalog {
  items: Nft[]
  total: number
  page: number
  pages: number
  facets: { categories: Record<string, number>; networks: Record<string, number> }
}
export interface Profile {
  id: string
  name: string
  email: string
  username: string
  bio: string
  avatar: string
  ens?: string
  walletAlias?: string
}
export interface Session {
  user: Profile | null
  expiresAt: number | null
}
export interface Wallet {
  id: string
  name: string
  address: string
  network: Network
  primary: boolean
  displayName?: string
  profileName?: string
  type?: string
  referral?: string
  email?: string
  ens?: string
  secondaryAddress?: string
}
export interface CartItem {
  nftId: string
  editionId: string
  quantity: number
}
export interface Cart {
  items: CartItem[]
  coupon: string
  version: number
}
export interface QuoteLine extends CartItem {
  name: string
  image: string
  edition: string
  unitPrice: Eth
  total: Eth
  available: number
}
export interface Quote {
  id: string
  expiresAt: number
  lines: QuoteLine[]
  subtotal: Eth
  discount: Eth
  fee: Eth
  total: Eth
  coupon: string
  fingerprint: string
}
export interface Collector {
  name: string
  email: string
  username: string
  profileName: string
  walletAddress: string
  secondaryAddress: string
  walletType: string
  referral: string
  ens: string
  note: string
}
export interface OrderInput {
  quoteId: string
  collector: Collector
  walletId: string
  network: Network
}
export type OrderStatus = 'pending' | 'confirmed' | 'declined'
export interface Order {
  id: string
  userId: string
  status: OrderStatus
  version: number
  quote: Quote
  collector: Collector
  wallet: Wallet
  transaction: string
  createdAt: number
  resolveAt: number
  outcome: 'confirmed' | 'declined'
}
export interface ApiError {
  code: string
  message: string
  fields?: Record<string, string>
}
export interface ResourceEvent {
  eventId: string
  resourceId: string
  version: number
  userId?: string
  sessionId?: string
}
export interface NftEvent extends ResourceEvent {
  nft: Nft
}
export interface OrderEvent extends ResourceEvent {
  order: Order
}
export interface Scenario {
  name: string
  latency: number
  variableLatency: boolean
  offline: boolean
  failNext: string
  status: number
  empty: boolean
  payment: 'confirmed' | 'declined'
  orderDelay: number
  timeoutAfterCreate: boolean
  couponExpired: boolean
  networkFee: Eth | null
}
