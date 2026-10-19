import { fileURLToPath } from 'node:url'
import { test, expect, reset, request, login, addFromDetail, connectWallet } from './helpers'

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('03b cadastro valida campos, conflito e criação de uma conta isolada', async ({ page }) => {
  await page.goto('/cadastro')
  const dialog = page.getByRole('dialog', { name: 'Criar conta', exact: true })
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(dialog.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await dialog.getByLabel('Nome de usuário', { exact: true }).fill('Nova Colecionadora')
  await dialog.getByLabel('E-mail', { exact: true }).fill('alice@example.test')
  await dialog.getByLabel('Senha', { exact: true }).fill('Colecionador123!')
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill('Colecionador123!')
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(dialog.getByText('Este e-mail já está cadastrado.', { exact: true })).toBeVisible()
  await dialog.getByLabel('E-mail', { exact: true }).fill('nova@example.test')
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await request(page, 'GET', '/session')).data.user.email).toBe('nova@example.test')
  expect((await request(page, 'GET', '/wallets')).data).toEqual([])
})

test('07 pagamento recusado, clique duplo e timeout recuperado com a mesma chave', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await request(page, 'PATCH', '/demo', { payment: 'declined', orderDelay: 200 })
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await page.getByRole('button', { name: 'Revisar compra', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).dblclick()
  await expect(page.getByRole('heading', { name: 'Pagamento recusado', exact: true })).toBeVisible()
  expect((await request(page, 'GET', '/orders')).data).toHaveLength(1)
  expect((await request(page, 'GET', '/cart')).data.items[0].quantity).toBe(1)
  await reset(page, { timeoutAfterCreate: true, orderDelay: 60_000 })
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await page.getByRole('button', { name: 'Revisar compra', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Uma tentativa de compra está em andamento' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Recuperar tentativa', exact: true })).toBeEnabled({
    timeout: 15_000,
  })
  const original = (await request(page, 'GET', '/orders')).data
  expect(original).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Recuperar tentativa', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Aguardando confirmação', exact: true }),
  ).toBeVisible()
  await request(page, 'POST', '/demo/settle')
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  const recovered = (await request(page, 'GET', '/orders')).data
  expect(recovered).toHaveLength(1)
  expect(recovered[0].id).toBe(original[0].id)
})

test('08 perfil, avatar, senha e carteiras persistem com validação', async ({ page }) => {
  test.setTimeout(60_000)
  await login(page, undefined, undefined, '/perfil')
  await page.getByLabel('Nome de exibição', { exact: true }).fill('Alice Colecionadora')
  await page
    .getByLabel('Avatar', { exact: true })
    .setInputFiles(
      fileURLToPath(
        new URL(
          '../public/images/artwork/8459204731e6eba9d474cbc8ebc37071360d3ba5-192.webp',
          import.meta.url,
        ),
      ),
    )
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('Perfil atualizado')
  await page.reload()
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue(
    'Alice Colecionadora',
  )
  expect((await request(page, 'GET', '/profile')).data.avatar).toMatch(/^data:image\/webp;base64,/)
  await page.getByLabel('Senha atual', { exact: true }).fill('errada')
  await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha456!')
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha456!')
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click()
  await expect(page.getByLabel('Senha atual', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByLabel('Senha atual', { exact: true }).fill('Colecionador123!')
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('Senha alterada')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await login(page, 'alice@example.test', 'NovaSenha456!', '/carteiras')
  await page.getByLabel('Apelido da carteira', { exact: true }).fill('Coleção Ethereum')
  await page.getByLabel('Endereço da carteira', { exact: true }).fill('inválido')
  await page.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(page.getByLabel('Endereço da carteira', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByLabel('Endereço da carteira', { exact: true }).fill(`0x${'c'.repeat(40)}`)
  await page.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('Carteira salva')
  await page.getByRole('button', { name: 'Adicionar carteira', exact: true }).click()
  const secondary = page.locator('.wallet-form').last()
  await secondary.getByLabel('Apelido da carteira', { exact: true }).fill('Reserva Polygon')
  await secondary.getByLabel('Endereço da carteira', { exact: true }).fill(`0x${'d'.repeat(40)}`)
  await secondary.getByRole('combobox', { name: /^Rede/ }).selectOption('Polygon')
  await secondary.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Carteira secundária', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Apelido da carteira', { exact: true }).nth(1)).toHaveValue(
    'Reserva Polygon',
  )
  const persisted = await page.evaluate(() => localStorage.getItem('kurio.mock.v1'))
  expect(persisted).not.toContain('NovaSenha456!')
  expect(persisted).not.toContain('Colecionador123!')
})

test('10 pendente desconecta, reconcilia, ignora eventos antigos e preserva quantidades novas', async ({
  page,
}) => {
  await request(page, 'PATCH', '/demo', { orderDelay: 60_000 })
  await addFromDetail(page)
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await page.getByRole('button', { name: 'Revisar compra', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Aguardando confirmação', exact: true }),
  ).toBeVisible()
  const order = (await request(page, 'GET', '/orders')).data[0]
  await request(page, 'POST', '/cart/items', { nftId: 'nft-1', editionId: 'standard', quantity: 2 })
  await request(page, 'POST', '/demo/disconnect')
  await request(page, 'POST', '/demo/settle')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  await request(page, 'POST', '/demo/order-event', { id: order.id, old: true, duplicate: true })
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  expect((await request(page, 'GET', '/orders')).data).toHaveLength(1)
  expect((await request(page, 'GET', '/cart')).data.items[0].quantity).toBe(2)
})

test('11 teclado, foco em diálogo e erros associados aos campos', async ({ page, isMobile }) => {
  const trigger = isMobile
    ? page.getByRole('button', { name: 'Abrir filtros', exact: true })
    : page.getByRole('button', { name: 'Buscar NFTs', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = page.getByLabel('E-mail', { exact: true })
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  const description = await email.getAttribute('aria-describedby')
  expect(description).toBeTruthy()
  await expect(page.locator(`[id="${description}"]`)).toContainText('e-mail válido')
})

test('12 skeleton com movimento reduzido, falha de conexão e retry', async ({ page }) => {
  await request(page, 'PATCH', '/demo', { latency: 1500 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/nft/nft-1')
  await expect(page.getByRole('status', { name: 'Carregando conteúdo' })).toBeVisible()
  expect(
    await page
      .locator('.skeleton')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await request(page, 'PATCH', '/demo', { latency: 0, offline: true })
  await page.goto('/nft/nft-2')
  await expect(
    page.getByRole('heading', { name: 'Algo não saiu como esperado', exact: true }),
  ).toBeVisible()
  await request(page, 'PATCH', '/demo', { offline: false })
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sage Nomad #009', exact: true })).toBeVisible()
})
