import type { Cart, Nft, Order, Profile, Quote, Scenario, Wallet } from '../domain/contracts'
import { eth } from '../domain/money'

export const databaseKey = 'kurio.mock.v1'
export const defaultScenario: Scenario = {
  name: 'success',
  latency: 80,
  variableLatency: false,
  offline: false,
  failNext: '',
  status: 503,
  empty: false,
  payment: 'confirmed',
  orderDelay: 1800,
  timeoutAfterCreate: false,
  couponExpired: false,
  networkFee: null,
}
export const artwork = [
  '8459204731e6eba9d474cbc8ebc37071360d3ba5',
  '2986a7cb16d09de8970824d2dd58bf0bb021702c',
  '9df2ff42dd27ba657621c304557d1a855a4be6a5',
  '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16',
].map((hash) => `/images/artwork/${hash}.png`)
interface User {
  profile: Profile
  passwordHash: string
  favorites: string[]
  wallets: Wallet[]
}
interface Database {
  schema: 1
  nfts: Nft[]
  users: Record<string, User>
  sessions: Record<string, { userId: string; expiresAt: number }>
  carts: Record<string, Cart>
  quotes: Record<string, Quote>
  quoteOwners: Record<string, string>
  orders: Record<string, Order>
  attempts: Record<string, { payload: string; orderId: string }>
  scenario: Scenario
  sequence: number
}
export async function passwordHash(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`kurio-demo-only:${password}`),
  )
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
export async function seed(): Promise<Database> {
  const hash = await passwordHash('Colecionador123!')
  const users: Record<string, User> = {}
  for (const [id, name, email, username] of [
    ['alice', 'Alice Martins', 'alice@example.test', 'alice'],
    ['bruno', 'Bruno Costa', 'bruno@example.test', 'bruno'],
  ]) {
    users[id] = {
      profile: {
        id,
        name,
        email,
        username,
        bio: 'Colecionando novas perspectivas.',
        avatar: artwork[id === 'alice' ? 0 : 1],
        ens: `${username}.eth`,
        walletAlias: 'Minha carteira',
      },
      passwordHash: hash,
      favorites: [],
      wallets: [
        {
          id: `${id}-wallet`,
          name: 'Minha carteira',
          address: `0x${id === 'alice' ? 'a' : 'b'}`.padEnd(42, id === 'alice' ? '1' : '2'),
          network: 'Ethereum',
          primary: true,
          displayName: name,
          profileName: username,
          type: 'MetaMask',
          referral: 'KURIO',
          email,
          ens: `${username}.eth`,
          secondaryAddress: '',
        },
      ],
    }
  }
  return {
    schema: 1,
    users,
    sessions: {},
    carts: {},
    quotes: {},
    quoteOwners: {},
    orders: {},
    attempts: {},
    scenario: { ...defaultScenario },
    sequence: 0,
    nfts: Array.from({ length: 36 }, (_, i) => {
      const imageIndex = [0, 1, 2, 1, 1, 2, 3, 3, 3][i % 9]
      return {
        id: `nft-${i + 1}`,
        name:
          [
            'Emerald Ape #042',
            'Sage Nomad #009',
            'Neon Vessel #552',
            'Cosmic Bloom #118',
            'Violet Nomad #314',
            'Ivory Baron #088',
            'Golden Beat #207',
            'Golden Echo #108',
            'Golden Signal #160',
          ][i % 9] + (i >= 9 ? ` · ${Math.floor(i / 9) + 1}` : ''),
        collection: i === 0 ? 'Kurio Apes' : i % 2 ? 'Nomad Collection' : 'Kurio Originals',
        creator: ['Yuga Labs', 'Digital Studio', 'Kurio Collective'][i % 3],
        category: [
          'Arte digital',
          'Fotografia',
          'Música',
          'Arte 3D',
          'Colecionáveis',
          'Generativa',
          'Jogos',
          'Assinaturas',
          'Utilidade',
        ][i % 9],
        price: eth(['1.19', '1.69', '1.99', '1.29', '1.39', '1.79', '0.99', '0.89', '0.39'][i % 9]),
        compareAtPrice: i === 2 ? eth('2.29') : undefined,
        rarity: i === 2 ? 'RARO' : undefined,
        image: artwork[imageIndex],
        gallery: Array.from({ length: 4 }, () => artwork[imageIndex]),
        description:
          'Uma peça única de uma coleção que conecta arte, identidade e comunidade. Descubra os detalhes e encontre a edição que combina com a sua coleção.',
        network: i % 5 === 4 ? 'Polygon' : i > 8 && i % 5 === 3 ? 'Solana' : 'Ethereum',
        editions: [
          { id: 'standard', name: '1/50', stock: 8 + (i % 5) },
          { id: 'rare', name: '1/1', stock: i % 6 === 1 ? 0 : 1 },
          { id: 'limited', name: '1/10', stock: 5 },
          { id: 'open', name: 'ABERTA', stock: 20 },
        ],
        version: 1,
      }
    }),
  }
}
let db: Database
export async function initializeDatabase() {
  try {
    const stored = JSON.parse(localStorage.getItem(databaseKey) ?? 'null') as Database | null
    db = stored?.schema === 1 ? stored : await seed()
  } catch {
    db = await seed()
  }
  // Enrich existing local catalogues without resetting carts, accounts or orders.
  for (const [index, nft] of db.nfts.entries())
    if (index > 8 && index % 5 === 3 && nft.version === 1) nft.network = 'Solana'
  if (db.nfts[0]?.id === 'nft-1' && db.nfts[0].collection === 'Kurio Originals')
    db.nfts[0].collection = 'Kurio Apes'
  const neon = db.nfts.find((nft) => nft.id === 'nft-3')
  if (neon) {
    neon.compareAtPrice ??= eth('2.29')
    neon.rarity ??= 'RARO'
  }
  db.quoteOwners ??= {}
  db.scenario = { ...defaultScenario, ...db.scenario }
  persist()
}
export const getDb = () => db
export function persist() {
  localStorage.setItem(databaseKey, JSON.stringify(db))
}
export async function resetDatabase(scenario: Partial<Scenario> = {}) {
  db = await seed()
  db.scenario = { ...defaultScenario, ...scenario }
  persist()
}
export function nextId(prefix: string) {
  db.sequence++
  return `${prefix}-${db.sequence}`
}
export function cartFor(owner: string): Cart {
  return (db.carts[owner] ??= { items: [], coupon: '', version: 1 })
}
