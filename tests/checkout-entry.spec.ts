import { test, expect, reset, addFromDetail, login, request, connectWallet } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('carrinho mantém login/cadastro em modal e finaliza conforme a sessão', async ({ page }) => {
  await addFromDetail(page)
  const start = page.getByRole('button', { name: 'Conectar e finalizar', exact: true })
  const quantity = page
    .locator('.cart-line')
    .getByLabel('Quantidade de Emerald Ape #042', { exact: true })
  await expect(quantity).toHaveText('1')
  await start.click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.locator('.cart-line')).toBeAttached()
  await page.keyboard.press('Escape')
  await expect(start).toBeFocused()
  await expect(quantity).toHaveText('1')
  await start.click()
  const dialog = page.getByRole('dialog', { name: 'Entrar', exact: true })
  await dialog.getByLabel('E-mail', { exact: true }).fill('alice@example.test')
  await dialog.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByRole('button', { name: 'Conectar carteira', exact: true })).toBeVisible()
  await page.goto('/carrinho')
  await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conectar e finalizar', exact: true })).toHaveCount(
    0,
  )
  const centered = await page.locator('.quote-values').evaluate((element) => {
    const quote = element.getBoundingClientRect()
    const text = document.createRange()
    text.selectNodeContents(element.querySelector('.estimated-fee dd')!)
    const label = text.getBoundingClientRect()
    return Math.abs(label.x + label.width / 2 - quote.x - quote.width / 2)
  })
  expect(centered).toBeLessThan(1)
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(page).toHaveURL(/\/pagamento$/)
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira', exact: true }),
  ).toBeVisible()
  const heading = (await page.locator('.receipt-items-heading').boundingBox())!
  const totals = (await page.locator('.receipt-body .quote-values').boundingBox())!
  expect(Math.abs(heading.x - totals.x)).toBeLessThan(1)
  expect(Math.abs(heading.width - totals.width)).toBeLessThan(1)
})

test('cadastro no carrinho preserva URL e itens e abre pagamento sem carteiras', async ({
  page,
  isMobile,
}) => {
  await addFromDetail(page)
  await page.getByRole('button', { name: 'Conectar e finalizar', exact: true }).click()
  if (isMobile)
    await page.getByRole('link', { name: 'Novo na Kurio? Crie uma conta', exact: true }).click()
  else
    await page
      .locator('.auth-tabs')
      .getByRole('link', { name: /Criar (conta|perfil)/ })
      .click()
  await expect(page).toHaveURL(/\/carrinho$/)
  const dialog = page.getByRole('dialog', { name: 'Criar conta', exact: true })
  await dialog.getByLabel('Nome de usuário', { exact: true }).fill('Nova Colecionadora')
  await dialog.getByLabel('E-mail', { exact: true }).fill('nova@example.test')
  await dialog.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill('Colecionador123!')
  await dialog.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(
    page.getByRole('link', { name: 'Cadastrar carteira Ethereum', exact: true }),
  ).toBeVisible()
  expect((await request(page, 'GET', '/cart')).data.items).toHaveLength(1)
  await page.reload()
  await expect(
    page.getByRole('link', { name: 'Cadastrar carteira Ethereum', exact: true }),
  ).toBeVisible()
  await request(page, 'PATCH', '/demo', { failNext: 'GET /api/wallets', status: 422 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Cadastrar carteira Ethereum', exact: true }),
  ).toBeVisible()
})

test('pagamento suporta carregamento lento, refresh e botão Salvar carteira sem quebra', async ({
  page,
}) => {
  await login(page)
  await addFromDetail(page)
  await request(page, 'PATCH', '/demo', { latency: 1200 })
  await page.goto('/pagamento')
  await expect(page.locator('#conteudo .skeleton').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conectar carteira', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Conectar carteira', exact: true })).toBeVisible()
  await request(page, 'PATCH', '/demo', { latency: 20 })
  await page.goto('/carteiras')
  const save = page.getByRole('button', { name: 'Salvar carteira', exact: true }).first()
  await expect(save).toBeVisible()
  const textLines = await save.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getClientRects().length
  })
  expect(textLines).toBe(1)
})
