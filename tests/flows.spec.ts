import { test, expect, reset, ready, request, login, addFromDetail, connectWallet } from './helpers'

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('01 catálogo combina URL, filtros, ordenação, paginação e histórico', async ({
  page,
  isMobile,
}) => {
  await expect(page.getByRole('link', { name: 'Ver Emerald Ape #042', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  if (isMobile) await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Arte digital', exact: true }).focus()
  await page.keyboard.press('Space')
  await page.getByRole('checkbox', { name: 'Ethereum', exact: true }).focus()
  await page.keyboard.press('Space')
  if (isMobile) await page.getByRole('button', { name: 'Ver resultados', exact: true }).click()
  await expect(page).toHaveURL(/page=1/)
  await expect(page).toHaveURL(/category=Arte/)
  await expect(page).toHaveURL(/network=Ethereum/)
  await page.reload()
  await ready(page)
  await expect(page.getByRole('link', { name: 'Ver Emerald Ape #042', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/category=Arte/)
  await page.goto('/?q=impossivel&sort=price-asc&page=1')
  await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
})

test('02 detalhe direto, galeria, edição esgotada e 404', async ({ page, isMobile }) => {
  await page.goto('/nft/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await page.goto('/nft/nft-2')
  await expect(page.getByLabel('1/1 · Esgotada')).toBeDisabled()
  await page.goto('/nft/nft-1')
  if (!isMobile) {
    await page.getByRole('button', { name: 'Ver imagem 2', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ver imagem 2', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }
  await page.getByRole('button', { name: 'Ampliar imagem' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Ampliar imagem' })).toBeFocused()
  await page.goto('/nft/inexistente')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado', exact: true })).toBeVisible()
  await page.goto('/rota-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})

test('03 login, refresh, expiração, retomada e troca de usuário', async ({ page }) => {
  await login(page, undefined, undefined, '/perfil')
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue('Alice Martins')
  await page.reload()
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue('Alice Martins')
  await request(page, 'POST', '/session/expire')
  await page.goto('/carteiras')
  await expect(page.getByRole('dialog', { name: 'Entrar', exact: true })).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill('bruno@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/carteiras/)
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue('Bruno Costa')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Entrar', exact: true })).toBeVisible()
})

test('04 favorito otimista persiste, falha faz rollback e permite repetir', async ({
  page,
  isMobile,
}) => {
  await login(page, undefined, undefined, '/nft/nft-1')
  const favorite = page.getByRole('button', { name: /Adicionar Emerald Ape.*favoritos/ })
  await request(page, 'PATCH', '/demo', { failNext: 'PUT /api/favorites', status: 503 })
  await favorite.click()
  await expect(page.locator('.toast')).toContainText('Falha simulada')
  await expect(favorite).toHaveAttribute('aria-pressed', 'false')
  if (isMobile) {
    const control = (await favorite.boundingBox())!
    const notification = (await page.locator('.toast').boundingBox())!
    expect(notification.y).toBeGreaterThanOrEqual(control.y + control.height)
  }
  // With a frozen clock the notice cannot expire on its own; dismiss it before retrying.
  await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click()
  await favorite.click()
  await expect(
    page.getByRole('button', { name: /Remover Emerald Ape.*favoritos/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.toast')).toContainText('NFT salvo nos favoritos')
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Remover Emerald Ape.*favoritos/ }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('05 carrinho, quantidade, cupons, refresh e merge no login', async ({ page }) => {
  await addFromDetail(page)
  await page
    .getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042', exact: true })
    .click()
  await expect(page.getByLabel('Quantidade de Emerald Ape #042', { exact: true })).toHaveText('2')
  await page.getByLabel('Código promocional', { exact: true }).fill('EXPIRED')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.locator('#coupon-error')).toBeVisible()
  await page.getByLabel('Código promocional', { exact: true }).fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByTestId('quote-total')).toHaveText('2.1445 ETH')
  await page.reload()
  await ready(page)
  await expect(page.getByTestId('quote-total')).toHaveText('2.1445 ETH')
  await login(page, undefined, undefined, '/carrinho')
  await expect(page.getByTestId('quote-total')).toHaveText('2.1445 ETH')
  await page.getByRole('button', { name: 'Remover cupom', exact: true }).click()
  await expect(page.getByTestId('quote-total')).toHaveText('2.3825 ETH')
  await page.getByRole('button', { name: 'Remover Emerald Ape #042', exact: true }).click()
  await page.getByRole('button', { name: 'Remover item', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

test('06 compra completa exige resposta confirmada e preserva recibo', async ({ page }) => {
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Revise sua compra' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  const receiptUrl = page.url()
  await expect(page.getByTestId('quote-total')).toHaveText('1.1925 ETH')
  await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '9.99' })
  await page.reload()
  await expect(page.getByTestId('quote-total')).toHaveText('1.1925 ETH')
  await expect(page).toHaveURL(receiptUrl)
  expect((await request(page, 'GET', '/cart')).data.items).toEqual([])
})

test('09 preço via Socket.IO durante revisão exige nova confirmação', async ({ page }) => {
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Revise sua compra' }).getByTestId('quote-total'),
  ).toHaveText('1.1925 ETH')
  await request(page, 'POST', '/demo/nft', { id: 'nft-1', price: '2', duplicate: true })
  await expect(page.locator('.toast')).toContainText('Preço ou disponibilidade atualizados')
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Revise sua compra' })).toBeVisible()
  await expect(page.getByRole('dialog').getByTestId('quote-total')).toHaveText('2.0025 ETH')
  expect((await request(page, 'GET', '/orders')).data).toHaveLength(0)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
})
