import { test, expect, reset, request, login, addFromDetail, connectWallet } from './helpers'

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('401 atrasado de outra conta não encerra a sessão atual nem restaura favoritos antigos', async ({
  page,
}) => {
  await login(page, undefined, undefined, '/nft/nft-1')
  await request(page, 'PATCH', '/demo', {
    latency: 6000,
    failNext: 'PUT /api/favorites',
    status: 401,
  })
  const pending = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/api/favorites/'),
  )
  await page.getByRole('button', { name: /Adicionar Emerald Ape.*favoritos/ }).click()
  await pending
  const lateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' && response.url().includes('/api/favorites/'),
  )
  await request(page, 'PATCH', '/demo', { latency: 20 })
  // Stay in the same document so the old mutation really can finish late.
  await page.getByRole('link', { name: 'Meu perfil', exact: true }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Entrar', exact: true })).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill('bruno@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue('Bruno Costa')
  await page.clock.fastForward(6500)
  expect((await lateResponse).status()).toBe(401)
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue('Bruno Costa')
  expect((await request(page, 'GET', '/session')).data.user.id).toBe('bruno')
  expect((await request(page, 'GET', '/favorites')).data).toEqual([])
  await expect(page.locator('.toast')).not.toContainText('Sessão expirada')
})

test('compra operável pelo teclado, do detalhe ao recibo', async ({ page }) => {
  const activate = async (target: ReturnType<typeof page.getByRole>) => {
    await target.focus()
    await expect(target).toBeFocused()
    await page.keyboard.press('Enter')
  }
  await page.goto('/nft/nft-1')
  await activate(page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }))
  await activate(page.getByRole('button', { name: 'Conectar e finalizar', exact: true }))
  await page.getByLabel('E-mail', { exact: true }).focus()
  await page.keyboard.type('alice@example.test')
  await page.getByLabel('Senha', { exact: true }).focus()
  await page.keyboard.type('Colecionador123!')
  await activate(page.getByRole('button', { name: 'Entrar', exact: true }))
  await activate(page.getByRole('button', { name: 'Conectar carteira', exact: true }))
  await activate(page.getByRole('button', { name: 'Autorizar conexão' }))
  await activate(page.getByRole('button', { name: 'Confirmar compra', exact: true }))
  await activate(page.getByRole('button', { name: 'Confirmar compra', exact: true }))
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  const receiptUrl = page.url()
  await activate(page.getByRole('button', { name: 'Ver no Etherscan', exact: true }))
  await expect(
    page.getByRole('status').filter({ hasText: 'Estamos preparando a consulta no explorador.' }),
  ).toBeVisible()
  await expect(page).toHaveURL(receiptUrl)
})

test('precisão decimal, limites inteiros, cotação privada e idempotência canônica', async ({
  page,
}) => {
  await login(page)
  for (const [id, price] of [
    ['nft-1', '0.1'],
    ['nft-2', '0.2'],
  ]) {
    await request(page, 'POST', '/demo/nft', { id, price })
    await request(page, 'POST', '/cart/items', { nftId: id, editionId: 'standard', quantity: 1 })
  }
  expect(
    (
      await request(page, 'POST', '/cart/items', {
        nftId: 'nft-1',
        editionId: 'standard',
        quantity: 0.5,
      })
    ).status,
  ).toBe(422)
  expect(
    (
      await request(page, 'POST', '/cart/items', {
        nftId: 'nft-1',
        editionId: 'standard',
        quantity: 999,
      })
    ).status,
  ).toBe(409)
  const quote = (await request(page, 'POST', '/quote', { network: 'Ethereum' })).data
  expect(quote.subtotal).toBe('0.300000000000000000')
  expect(quote.total).toBe('0.302500000000000000')
  const profile = (await request(page, 'GET', '/profile')).data
  const wallet = (await request(page, 'GET', '/wallets')).data[0]
  const collector = {
    name: profile.name,
    email: profile.email,
    username: profile.username,
    profileName: profile.name,
    walletAddress: wallet.address,
    secondaryAddress: '',
    walletType: wallet.type,
    referral: wallet.referral,
    ens: wallet.ens,
    note: '',
  }
  const input = { quoteId: quote.id, walletId: wallet.id, network: wallet.network, collector }
  const visitorQuote = (
    await request(page, 'POST', '/quote', { network: 'Ethereum' }, { Authorization: '' })
  ).data
  expect(
    (
      await request(
        page,
        'POST',
        '/orders',
        { ...input, quoteId: visitorQuote.id },
        { 'Idempotency-Key': 'wrong-owner' },
      )
    ).status,
  ).toBe(409)
  await request(page, 'PATCH', '/demo', { orderDelay: 60000 })
  const first = await request(page, 'POST', '/orders', input, {
    'Idempotency-Key': 'canonical-key',
  })
  expect(first.status).toBe(200)
  const reordered = {
    collector: Object.fromEntries(Object.entries(collector).reverse()),
    network: input.network,
    walletId: input.walletId,
    quoteId: input.quoteId,
  }
  expect(
    (await request(page, 'POST', '/orders', reordered, { 'Idempotency-Key': 'canonical-key' })).data
      .id,
  ).toBe(first.data.id)
  await page.clock.fastForward(5 * 60_000 + 1)
  expect(
    (await request(page, 'POST', '/orders', input, { 'Idempotency-Key': 'expired-quote' })).status,
  ).toBe(409)
})

test('taxa alterada exige nova confirmação, cupom expirado e estoque bloqueiam envio', async ({
  page,
}) => {
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  const review = page.getByRole('dialog', { name: 'Revise sua compra' })
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(review.getByTestId('quote-total')).toHaveText('1.1925 ETH')
  await request(page, 'PATCH', '/demo', { networkFee: '0.01' })
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(review.getByTestId('quote-total')).toHaveText('1.2 ETH')
  expect((await request(page, 'GET', '/orders')).data).toHaveLength(0)
  await page.keyboard.press('Escape')
  await request(page, 'PUT', '/cart/coupon', { coupon: 'KURIO10' })
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(review).toBeVisible()
  await request(page, 'PATCH', '/demo', { couponExpired: true })
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(review).not.toBeVisible()
  await expect(page.locator('.toast')).toContainText('cupom expirou')
  expect((await request(page, 'GET', '/orders')).data).toHaveLength(0)
  await request(page, 'DELETE', '/cart/coupon')
  await page.reload()
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(review).toBeVisible()
  await request(page, 'POST', '/demo/nft', { id: 'nft-1', stock: 0 })
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(review).not.toBeVisible()
  await expect(page.locator('.toast')).toContainText('Disponibilidade alterada')
  expect((await request(page, 'GET', '/orders')).data).toHaveLength(0)
  expect((await request(page, 'GET', '/cart')).data.items).toHaveLength(1)
})

test('carteira pode recusar e desconectar; sessão expirada preserva rascunho do checkout', async ({
  page,
  isMobile,
}) => {
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  const review = page.getByRole('button', { name: 'Confirmar compra', exact: true })
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  await page.getByRole('button', { name: 'Recusar conexão', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('Conexão recusada')
  await expect(review).toBeDisabled()
  await connectWallet(page)
  await page.getByRole('button', { name: 'Desconectar carteira', exact: true }).click()
  await expect(review).toBeDisabled()
  await connectWallet(page)
  if (isMobile) {
    await review.click()
    await page.getByRole('button', { name: 'Editar dados', exact: true }).click()
  }
  await page
    .getByLabel('Observação do colecionador (opcional)', { exact: true })
    .fill('Preservar meu contexto')
  await request(page, 'POST', '/session/expire')
  await review.click()
  await expect(page.getByRole('dialog', { name: 'Entrar', exact: true })).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/pagamento/)
  await expect(
    page.getByLabel('Observação do colecionador (opcional)', { exact: true }),
  ).toHaveValue('Preservar meu contexto')
  expect((await request(page, 'GET', '/cart')).data.items).toHaveLength(1)
})

test('reconexão reconcilia carrinho por REST e evento antigo não altera preço', async ({
  page,
}) => {
  await addFromDetail(page)
  await expect(page.getByLabel('Tempo real conectado', { exact: true })).toBeAttached()
  await request(page, 'POST', '/demo/disconnect')
  await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '0.4' })
  await expect(page.getByTestId('quote-total')).toHaveText('0.4025 ETH')
  await expect(page.getByLabel('Tempo real conectado', { exact: true })).toBeAttached()
  await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '9', old: true, duplicate: true })
  expect((await request(page, 'GET', '/nfts/nft-1')).data.price).toBe('0.400000000000000000')
  await expect(page.getByTestId('quote-total')).toHaveText('0.4025 ETH')
})

test('busca descarta resposta lenta e ordenação corresponde aos parâmetros REST', async ({
  page,
  isMobile,
}) => {
  await request(page, 'PATCH', '/demo', { variableLatency: true })
  await page.goto('/?q=a&sort=price-desc&page=1')
  if (isMobile) await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
  const filters = isMobile
    ? page.getByRole('dialog', { name: 'Filtrar NFTs' })
    : page.locator('.catalog-sidebar')
  await filters.getByText('Mais filtros', { exact: true }).click()
  await filters.getByLabel('Buscar no catálogo', { exact: true }).fill('Emerald Ape #042 · 2')
  if (isMobile) await page.getByRole('button', { name: 'Ver resultados', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Ver Emerald Ape #042 · 2', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.nft-card')).toHaveCount(1)
  await page.clock.runFor(1100)
  await expect(page.locator('.nft-card')).toHaveCount(1)
  await page.goto('/?sort=price-asc&page=1')
  await expect(page.locator('.nft-card').first()).toContainText('Golden Signal #160')
  const result = (await request(page, 'GET', '/nfts?sort=price-asc&page=1')).data
  expect(result.items[0].id).toBe('nft-9')
})

test('nove telas sem overflow em 390, 768, 1440 e texto ampliado', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A própria verificação percorre os três tamanhos.')
  test.setTimeout(120000)
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/login', '/cadastro']) {
      await page.goto(path)
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
    }
  }
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  const receipt = new URL(page.url()).pathname
  await request(page, 'POST', '/cart/items', { nftId: 'nft-2', editionId: 'standard', quantity: 1 })
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of [
      '/',
      '/nft/nft-1',
      '/carrinho',
      '/pagamento',
      receipt,
      '/perfil',
      '/carteiras',
    ]) {
      await page.goto(path)
      await expect(page.locator('#conteudo h1').first()).toBeAttached()
      await expect(page.locator('.skeleton')).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${path} em ${width}px`,
      ).toBe(true)
    }
  }
  await page.setViewportSize({ width: 768, height: 1000 })
  await page.goto('/perfil')
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toBeVisible()
  // Browser zoom halves the effective CSS viewport and doubles physical pixel density.
  const zoom = await page.context().newCDPSession(page)
  await zoom.send('Emulation.setDeviceMetricsOverride', {
    width: 384,
    height: 500,
    deviceScaleFactor: 2,
    mobile: false,
  })
  expect(await page.evaluate(() => devicePixelRatio)).toBe(2)
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
})
