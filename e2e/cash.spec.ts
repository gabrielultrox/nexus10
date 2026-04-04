import { expect, test } from '@playwright/test'

import { prepareE2EPage } from './fixtures/app'

test.describe('Fluxo E2E - Caixa', () => {
  test('abre e fecha o caixa no mesmo fluxo', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })

    await page.goto('/cash')
    await expect(page.getByRole('heading', { name: 'Caixa', exact: true })).toBeVisible()

    await page.getByRole('textbox', { name: 'Valor' }).fill('100,00')
    await page.getByRole('button', { name: /registrar abertura/i }).click()
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText(/abertura de caixa/i).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: /r\$\s*100,00/i })).toBeVisible()

    await page.getByRole('button', { name: /^fechar caixa$/i }).click()
    await page.getByRole('button', { name: /registrar fechamento/i }).click()
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText(/fechamento de caixa/i).first()).toBeVisible()
    await expect(page.getByText(/caixa fechado/i)).toBeVisible()
  })
})
