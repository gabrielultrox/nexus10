import { expect, test } from '@playwright/test'

import { prepareE2EPage, setE2EFailures } from './fixtures/app'
import { addFirstCatalogProduct, finishOrderLikeFlow } from './helpers/commerce'

test.describe('Fluxo E2E - Pedidos', () => {
  test('cria um pedido novo com sucesso', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })

    await page.goto('/orders/new')
    await expect(page.getByRole('heading', { name: /novo pedido/i })).toBeVisible()
    await addFirstCatalogProduct(page)
    await finishOrderLikeFlow(page, 'order')

    await expect(page.getByRole('heading', { name: /detalhe do pedido/i })).toBeVisible()
    await expect(page.getByText('Cliente E2E', { exact: true })).toBeVisible()
    await expect(page.getByText(/PED-0001/i).first()).toBeVisible()
  })

  test('mostra erro amigavel quando a criacao falha', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })
    await page.goto('/orders/new')
    await expect(page.getByRole('heading', { name: /novo pedido/i })).toBeVisible()
    await setE2EFailures(page, { createOrder: 1 })

    await addFirstCatalogProduct(page)
    await finishOrderLikeFlow(page, 'order')

    await expect(page.getByText(/falha simulada ao salvar o pedido/i)).toBeVisible()
  })
})
