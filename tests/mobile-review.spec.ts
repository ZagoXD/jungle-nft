import { test, expect, reset, ready, login, request } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('mobile: aba ativa, campos alinhados e painéis fixos sem esconder o conteúdo', async ({
  page,
}) => {
  await page.goto('/cadastro')
  await expect(page.getByLabel('Nome de usuário', { exact: true })).toHaveCSS('text-align', 'left')
  await login(page)
  for (const [path, name] of [
    ['/', 'Início'],
    ['/favoritos', 'Favoritos'],
    ['/perfil', 'Perfil'],
    ['/carteiras', 'Perfil'],
  ]) {
    await page.goto(path)
    const nav = page.getByRole('navigation', { name: 'Navegação mobile', exact: true })
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1)
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const colors = await nav
      .locator('a')
      .evaluateAll((links) =>
        links.map((link) => [link.getAttribute('aria-current'), getComputedStyle(link).color]),
      )
    expect(colors.find(([active]) => active === 'page')![1]).not.toBe(
      colors.find(([active]) => !active)![1],
    )
  }
  for (const size of [
    { width: 390, height: 844 },
    { width: 414, height: 640 },
  ]) {
    await page.setViewportSize(size)
    await page.goto('/nft/nft-1')
    const dock = page.getByRole('group', { name: 'Comprar este NFT', exact: true })
    await expect(dock).toHaveCSS('position', 'fixed')
    await page.evaluate(() => window.scrollBy(0, 600))
    const box = (await dock.boundingBox())!
    expect(Math.abs(box.y + box.height - size.height)).toBeLessThan(1)
    await page.getByRole('button', { name: 'Comprar NFT', exact: true }).tap()
    const cart = page.getByRole('complementary', { name: 'Resumo da compra', exact: true })
    await expect(cart).toHaveCSS('position', 'fixed')
    const summary = (await cart.boundingBox())!
    expect(Math.abs(summary.y + summary.height - size.height)).toBeLessThan(1)
    expect(
      await page
        .locator('#conteudo')
        .evaluate((main) => parseFloat(getComputedStyle(main).paddingBottom)),
    ).toBeGreaterThan(summary.height)
    await page.getByRole('button', { name: 'Finalizar', exact: true }).tap()
    await expect(page.locator('.checkout-dock')).toHaveCSS('position', 'fixed')
    await expect(page.getByRole('button', { name: 'Detalhes da compra', exact: true })).toHaveCount(
      0,
    )
    await expect(
      page.getByRole('button', { name: 'Dados do colecionador', exact: true }),
    ).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
  }
})

test('mobile: toque, ordenação, histórico, retrato e paisagem', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 414, height: 896 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Em alta', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Em alta', exact: true })).toHaveClass('active')
    await page.getByRole('button', { name: 'Abrir filtros', exact: true }).tap()
    await page
      .getByRole('combobox', { name: 'Ordenar NFTs', exact: true })
      .selectOption('price-asc')
    await page.getByRole('dialog').getByText('Arte digital', { exact: true }).tap()
    await page.getByRole('button', { name: 'Ver resultados', exact: true }).tap()
    await expect(page).toHaveURL(/sort=price-asc/)
    await page.reload()
    await expect(
      page.getByRole('link', { name: 'Ver Emerald Ape #042', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Novos lançamentos', exact: true }).tap()
    await page.goBack()
    await expect(page).toHaveURL(/sort=price-asc/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
  }
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/login')
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).tap()
  await expect(page.getByRole('dialog', { name: 'Entrar', exact: true })).toBeHidden()
})

test('mobile: gesto da galeria, favorito, edição, carrinho e cupom por toque', async ({ page }) => {
  await page.goto('/nft/nft-1')
  const artwork = page.locator('.main-art > img')
  await expect(artwork).toHaveAttribute('alt', /imagem 1 de 4/)
  const box = (await artwork.boundingBox())!
  const touch = await page.context().newCDPSession(page)
  await touch.send('Input.synthesizeScrollGesture', {
    x: box.x + box.width * 0.8,
    y: box.y + box.height * 0.5,
    xDistance: -box.width * 0.6,
    yDistance: 0,
    gestureSourceType: 'touch',
    preventFling: true,
    speed: 400,
  })
  await expect(artwork).toHaveAttribute('alt', /imagem 2 de 4/)
  await page.getByRole('button', { name: 'Imagem anterior', exact: true }).tap()
  await expect(artwork).toHaveAttribute('alt', /imagem 1 de 4/)
  await page.getByRole('button', { name: /Adicionar Emerald Ape/ }).tap()
  const auth = page.getByRole('dialog', { name: 'Entrar', exact: true })
  await auth.getByLabel('E-mail', { exact: true }).fill('alice@example.test')
  await auth.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await auth.getByRole('button', { name: 'Entrar', exact: true }).tap()
  await page.getByRole('button', { name: /Adicionar Emerald Ape/ }).tap()
  await expect(page.getByRole('button', { name: /Remover Emerald Ape/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page
    .locator('.edition-picker label')
    .filter({ hasText: /^1\/10$/ })
    .tap()
  await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).tap()
  await page.getByRole('button', { name: 'Comprar NFT', exact: true }).tap()
  const line = page.getByRole('article', { name: 'Emerald Ape #042, 1/10', exact: true })
  await expect(line.getByLabel('Quantidade de Emerald Ape #042', { exact: true })).toHaveText('2')
  await line
    .getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042', exact: true })
    .tap()
  await expect(line.getByLabel('Quantidade de Emerald Ape #042', { exact: true })).toHaveText('3')
  await page.getByLabel('Código promocional', { exact: true }).fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).tap()
  await expect(page.getByTestId('quote-total')).toHaveText('3.2155 ETH')
  await line.getByRole('button', { name: 'Remover Emerald Ape #042', exact: true }).tap()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).tap()
  await expect(line).toBeVisible()
})

test('mobile: troca de rede/carteira, recusa, dados, revisão e confirmação por toque', async ({
  page,
}) => {
  await login(page, undefined, undefined, '/perfil')
  const primary = (await request(page, 'GET', '/wallets')).data[0]
  const secondary = await request(page, 'POST', '/wallets', {
    ...primary,
    id: undefined,
    primary: false,
    name: 'Reserva',
    network: 'Polygon',
    address: `0x${'c'.repeat(40)}`,
  })
  expect(secondary.status).toBe(200)
  await request(page, 'POST', '/cart/items', { nftId: 'nft-1', editionId: 'standard', quantity: 1 })
  await page.goto('/pagamento')
  await page.getByRole('button', { name: 'Trocar carteira', exact: true }).tap()
  const picker = page.getByRole('dialog', { name: 'Trocar carteira', exact: true })
  await picker
    .getByRole('combobox', { name: 'Rede da carteira', exact: true })
    .selectOption('Polygon')
  await picker.getByRole('button', { name: 'Reserva', exact: true }).tap()
  await expect(page.getByRole('radio', { name: 'Reserva, Polygon', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).tap()
  await page.getByRole('button', { name: 'Recusar conexão', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).tap()
  await page.getByRole('button', { name: 'Autorizar conexão', exact: true }).tap()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).tap()
  await page.getByRole('button', { name: 'Editar dados', exact: true }).tap()
  await page.getByLabel('Nome de exibição', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Salvar dados', exact: true }).tap()
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByLabel('Nome de exibição', { exact: true }).fill('Alice Mobile')
  await page.getByRole('button', { name: 'Salvar dados', exact: true }).tap()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).tap()
  await page
    .getByRole('button', { name: 'Tem um código promocional? Aplique aqui', exact: true })
    .tap()
  await page.getByLabel('Código promocional', { exact: true }).fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).tap()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).tap()
  const review = page.getByRole('dialog', { name: 'Revise sua compra', exact: true })
  await expect(review.getByTestId('quote-total')).toHaveText('1.0711 ETH')
  await expect(review).toContainText('Alice Mobile')
  await review.getByRole('button', { name: 'Confirmar compra', exact: true }).tap()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira', exact: true }),
  ).toBeVisible()
  const order = (await request(page, 'GET', '/orders')).data[0]
  expect(order.wallet.id).toBe(secondary.data.id)
  expect(order.quote.total).toBe('1.071100000000000000')
  expect((await request(page, 'GET', '/cart')).data.items).toHaveLength(0)
})
