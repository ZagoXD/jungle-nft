import { test, expect, reset, login, addFromDetail, connectWallet } from './helpers'

test('regressão visual início, detalhe, carrinho e pagamento', async ({ page }) => {
  await reset(page, { latency: 0 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const capture = async (name: string) => {
    const closeNotice = page.getByRole('button', { name: 'Fechar notificação', exact: true })
    if (await closeNotice.isVisible()) await closeNotice.click()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        Array.from(document.images, (image) => {
          image.loading = 'eager'
          return image.decode().catch(() => {})
        }),
      )
    })
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.003,
      mask: [page.locator('.connection-status')],
      maskColor: '#140d0a',
    })
  }
  await expect(page.getByRole('link', { name: 'Ver Emerald Ape #042', exact: true })).toBeVisible()
  await capture('inicio')
  await page.goto('/nft/nft-1')
  await expect(page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ })).toBeVisible()
  await capture('detalhe')
  await addFromDetail(page)
  await capture('carrinho')
  await login(page, undefined, undefined, '/pagamento')
  await connectWallet(page)
  await expect(page.getByRole('button', { name: 'Revisar compra', exact: true })).toBeEnabled()
  await capture('pagamento')
})
