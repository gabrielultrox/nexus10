import { expect, test } from '@playwright/test'

import { prepareE2EPage, setE2EFailures } from './fixtures/app'
import { addFirstCatalogProduct, finishOrderLikeFlow } from './helpers/commerce'

test.describe('Fluxo E2E - Vendas', () => {
  test('cria uma venda direta com sucesso', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })

    await page.goto('/sales/new')
    await expect(page.getByRole('heading', { name: /nova venda/i })).toBeVisible()
    await addFirstCatalogProduct(page)
    await finishOrderLikeFlow(page, 'sale')

    await expect(page.getByRole('heading', { name: /detalhe da venda/i })).toBeVisible()
    await expect(page.getByText('Cliente E2E', { exact: true })).toBeVisible()
    await expect(page.getByText(/VEN-0001/i).first()).toBeVisible()
  })

  test('mostra erro quando o lancamento falha', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })
    await page.goto('/sales/new')
    await expect(page.getByRole('heading', { name: /nova venda/i })).toBeVisible()
    await setE2EFailures(page, { createSale: 1 })

    await addFirstCatalogProduct(page)
    await finishOrderLikeFlow(page, 'sale')

    await expect(page.getByText(/falha simulada ao lancar a venda/i)).toBeVisible()
  })
})
