import { expect, test as base, type Page } from '@playwright/test'
import type { Scenario } from '../src/domain/contracts'

export async function request(
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
          'X-Visitor-Id': localStorage.getItem('kurio.visitor') ?? 'test-visitor',
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
export async function ready(page: Page) {
  await expect(page.locator('#conteudo')).toBeAttached()
}
export async function reset(page: Page, scenario: Partial<Scenario> = {}) {
  await page.goto('/')
  await ready(page)
  await request(page, 'POST', '/demo/reset', { latency: 20, orderDelay: 400, ...scenario })
  await page.evaluate(() => {
    localStorage.removeItem('kurio.session')
    sessionStorage.clear()
  })
  await page.reload()
  await ready(page)
}
export async function login(
  page: Page,
  email = 'alice@example.test',
  password = 'Colecionador123!',
  next = '/',
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  const dialog = page.getByRole('dialog', { name: 'Entrar', exact: true })
  await dialog.getByLabel('E-mail', { exact: true }).fill(email)
  await dialog.getByLabel('Senha', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}
export async function addFromDetail(page: Page, id = 'nft-1') {
  await page.goto(`/nft/${id}`)
  await expect(page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ })).toBeVisible()
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/carrinho/)
  await expect(page.getByTestId('quote-total')).toBeVisible()
}
export async function connectWallet(page: Page) {
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  await page.getByRole('button', { name: 'Autorizar conexão' }).click()
  await expect(
    page.getByRole('button', { name: 'Desconectar carteira', exact: true }),
  ).toBeVisible()
}
export const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /This library called use\(|Rendered.*hooks|Maximum update depth|Cannot update a component/.test(
          message.text(),
        )
      )
        runtimeErrors.push(message.text())
    })
    await page.clock.install({ time: new Date('2026-07-29T14:00:00Z') })
    await use(page)
    expect(runtimeErrors, 'A aplicação deve terminar sem erros de runtime ou de hooks.').toEqual([])
  },
})
export { expect }
