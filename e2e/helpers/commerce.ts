import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function addFirstCatalogProduct(page: Page, productName = 'Produto E2E 1') {
  await page.getByRole('button', { name: /f9 - pesquisar produto/i }).click()
  const pickerDialog = page.getByRole('dialog', { name: /pesquisar produtos/i })
  await expect(pickerDialog).toBeVisible()
  await pickerDialog.getByRole('button', { name: new RegExp(productName, 'i') }).click()
  await page.getByPlaceholder('Qtd').fill('2')
  await page.getByPlaceholder('Valor').fill('12.50')
  await page.getByRole('button', { name: '+' }).click()
  await expect(page.getByText(productName)).toBeVisible()
}

export async function finishOrderLikeFlow(page: Page, itemPrefix: 'order' | 'sale') {
  await page.getByRole('button', { name: /avancar/i }).click()
  await page.getByPlaceholder('Buscar cliente').fill('Cliente E2E')
  await page.getByLabel('Forma de pagamento').selectOption('PIX')
  await page.locator(`#${itemPrefix}-address`).fill('Rua Teste, 123')
  await page.locator(`#${itemPrefix}-freight`).fill('5')
  await page.getByRole('button', { name: 'Lancar' }).click()
}
