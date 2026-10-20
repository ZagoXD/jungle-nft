import { test, expect, reset, login, request, addFromDetail, connectWallet } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('avisos expiram e podem ser fechados sobre o login sem fechar o modal', async ({ page }) => {
  await page.goto('/login')
  const google = page.getByRole('button', { name: 'Continuar com Google', exact: true })
  await google.click()
  await expect(page.locator('.toast')).toContainText('disponível em breve')
  await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Entrar', exact: true })).toBeVisible()
  await google.click()
  await page.mouse.move(0, 0)
  await page.clock.fastForward(6500)
  await expect(page.locator('.toast')).toBeHidden()
})

test('ENS separado persiste com domínio, e senha inválida não altera o perfil', async ({
  page,
}) => {
  await login(page, undefined, undefined, '/perfil')
  await expect(page.locator('.desktop-nav a').first()).toHaveClass(/active/)
  await expect(
    page.getByRole('combobox', { name: 'Domínio de Nome ENS', exact: true }),
  ).toHaveValue('.eth')
  const ens = page.getByLabel('Nome ENS', { exact: true })
  await expect(ens).toHaveValue('alice')
  await ens.fill('aurora')
  await ens.press('Tab')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('Perfil atualizado')
  expect((await request(page, 'GET', '/profile')).data.ens).toBe('aurora.eth')
  const rejected = await request(page, 'PATCH', '/profile', {
    name: 'Nome indevido',
    currentPassword: 'incorreta',
    password: 'SenhaNova123!',
    confirm: 'SenhaNova123!',
  })
  expect(rejected.status).toBe(422)
  expect((await request(page, 'GET', '/profile')).data.name).toBe('Alice Martins')
  await page.reload()
  await expect(page.getByLabel('Nome ENS', { exact: true })).toHaveValue('aurora')
})

test('favorito preenchido, abas selecionadas e rede Solana correspondem ao estado real', async ({
  page,
  isMobile,
}) => {
  await login(page, undefined, undefined, '/nft/nft-1')
  await page.getByRole('button', { name: /Adicionar Emerald Ape/ }).click()
  const favorite = page.getByRole('button', { name: /Remover Emerald Ape/ })
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
  await expect(favorite.locator('img')).toHaveAttribute('src', '/images/vectors/heart-filled.svg')
  await page.goto('/')
  if (!isMobile) {
    await page.getByRole('button', { name: 'Novos lançamentos', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Novos lançamentos', exact: true })).toHaveClass(
      'active',
    )
    await page.getByRole('button', { name: 'Em alta', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Em alta', exact: true })).toHaveClass('active')
  } else await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
  const solana = page.getByRole('checkbox', { name: 'Solana', exact: true })
  await solana.focus()
  await page.keyboard.press('Space')
  await expect(page).toHaveURL(/network=Solana/)
  const result = (await request(page, 'GET', '/nfts?network=Solana')).data
  expect(result.total).toBeGreaterThan(0)
  expect(result.items.every((nft: { network: string }) => nft.network === 'Solana')).toBe(true)
})

test('código promocional abre sob demanda no pagamento e mantém validação da API', async ({
  page,
  isMobile,
}) => {
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  if (isMobile) {
    await connectWallet(page)
    await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  }
  const summary = isMobile
    ? page.getByRole('dialog', { name: 'Revise sua compra', exact: true })
    : page.locator('.checkout-costs')
  await expect(summary.getByLabel('Código promocional', { exact: true })).toBeHidden()
  await summary
    .getByRole('button', { name: 'Tem um código promocional? Aplique aqui', exact: true })
    .click()
  await summary.getByLabel('Código promocional', { exact: true }).fill('EXPIRED')
  await summary.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(summary.locator(isMobile ? '#review-coupon-error' : '#coupon-error')).toBeVisible()
  await summary.getByLabel('Código promocional', { exact: true }).fill('KURIO10')
  await summary.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(summary.getByText('KURIO10 aplicado', { exact: true })).toBeVisible()
  await expect(summary.getByText('Taxa estimada', { exact: true })).toBeVisible()
})

test('carteira secundária copia dados e mantém validação de duplicidade', async ({ page }) => {
  await login(page, undefined, undefined, '/carteiras')
  await page.getByRole('checkbox', { name: 'Igual à carteira principal', exact: true }).check()
  const secondary = page.locator('.wallet-form').last()
  await expect(secondary.getByLabel('Endereço da carteira', { exact: true })).toHaveValue(
    `0xa${'1'.repeat(39)}`,
  )
  await secondary.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(secondary.getByRole('alert')).toContainText('já está cadastrada')
  await secondary.getByLabel('Apelido da carteira', { exact: true }).fill('Reserva')
  await secondary.getByLabel('Endereço da carteira', { exact: true }).fill(`0x${'c'.repeat(40)}`)
  await secondary.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nova carteira', exact: true })).toBeHidden()
  await expect(page.locator('.toast')).toContainText('Carteira salva')
  await page.reload()
  await expect(page.getByLabel('Apelido da carteira', { exact: true }).nth(1)).toHaveValue(
    'Reserva',
  )
})
