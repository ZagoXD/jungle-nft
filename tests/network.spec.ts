import { test, expect, type Page } from '@playwright/test'

async function request(
  page: Page,
  method: string,
  url: string,
  data?: unknown,
  extra: Record<string, string> = {},
) {
  return page.evaluate(
    async ({ method, url, data, extra }) => {
      const token = localStorage.getItem('kurio.session')
      const response = await fetch(`/api${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': 'test-visitor',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extra,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      })
      return { status: response.status, data: await response.json() }
    },
    { method, url, data, extra },
  )
}
test('REST persistente, precisão ETH, isolamento e criação idempotente', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#conteudo')).toBeAttached()
  expect(
    (await request(page, 'POST', '/demo/reset', { latency: 0, orderDelay: 60_000 })).status,
  ).toBe(200)
  const catalog = await request(page, 'GET', '/nfts?category=Arte%20digital&sort=price-asc&page=2')
  expect(catalog.data.page).toBe(2)
  expect((await request(page, 'GET', '/nfts/missing')).status).toBe(404)
  await request(page, 'POST', '/cart/items', { nftId: 'nft-1', editionId: 'standard', quantity: 2 })
  const login = await request(page, 'POST', '/session/login', {
    email: 'alice@example.test',
    password: 'Colecionador123!',
  })
  expect(login.status).toBe(200)
  await page.evaluate((token) => localStorage.setItem('kurio.session', token), login.data.token)
  const cart = await request(page, 'GET', '/cart')
  expect(cart.data.items[0].quantity).toBe(2)
  await request(page, 'PUT', '/cart/coupon', { coupon: 'KURIO10' })
  const quote = await request(page, 'POST', '/quote', { network: 'Ethereum' })
  expect(quote.data.subtotal).toBe('2.380000000000000000')
  expect(quote.data.total).toBe('2.144500000000000000')
  const input = {
    quoteId: quote.data.id,
    walletId: 'alice-wallet',
    network: 'Ethereum',
    collector: {
      name: 'Alice Martins',
      email: 'alice@example.test',
      username: 'alice',
      profileName: 'Alice',
      walletAddress: '0xa111111111111111111111111111111111111111',
      secondaryAddress: '',
      walletType: 'MetaMask',
      referral: 'KURIO',
      ens: 'alice.eth',
      note: '',
    },
  }
  const first = await request(page, 'POST', '/orders', input, {
    'Idempotency-Key': 'test-order-key',
  })
  expect(first.status).toBe(200)
  const second = await request(page, 'POST', '/orders', input, {
    'Idempotency-Key': 'test-order-key',
  })
  expect(second.data.id).toBe(first.data.id)
  expect(
    (
      await request(
        page,
        'POST',
        '/orders',
        { ...input, network: 'Polygon' },
        { 'Idempotency-Key': 'test-order-key' },
      )
    ).status,
  ).toBe(409)
  await request(page, 'POST', '/demo/settle')
  const receipt = await request(page, 'GET', `/orders/${first.data.id}`)
  expect(receipt.data.status).toBe('confirmed')
  await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '0.9' })
  expect((await request(page, 'GET', `/orders/${first.data.id}`)).data.quote.total).toBe(
    '2.144500000000000000',
  )
  expect((await request(page, 'GET', '/cart')).data.items).toEqual([])
  await page.reload()
  await expect(page.locator('#conteudo')).toBeAttached()
  expect((await request(page, 'GET', '/session')).data.user.id).toBe('alice')
  await request(page, 'POST', '/session/logout')
  const bruno = await request(page, 'POST', '/session/login', {
    email: 'bruno@example.test',
    password: 'Colecionador123!',
  })
  await page.evaluate((token) => localStorage.setItem('kurio.session', token), bruno.data.token)
  expect((await request(page, 'GET', `/orders/${first.data.id}`)).status).toBe(403)
})

test('evento NFT atravessa MSW e socket.io-client até o feedback acessível', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#conteudo')).toBeAttached()
  await expect
    .poll(async () => {
      await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '0.7', duplicate: true })
      return page.locator('.toast').textContent()
    })
    .toContain('Preço ou disponibilidade atualizados')
  await request(page, 'POST', '/demo/disconnect')
  await expect
    .poll(async () => {
      await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '0.8' })
      return (await request(page, 'GET', '/nfts/nft-1')).data.price
    })
    .toBe('0.800000000000000000')
})
