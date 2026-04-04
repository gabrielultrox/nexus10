import { expect, test } from '@playwright/test'

import { loginViaUi, prepareE2EPage } from './fixtures/app'

test.describe('Fluxo E2E - Login', () => {
  test('faz login local com PIN e senha corretos', async ({ page }) => {
    await prepareE2EPage(page)

    await loginViaUi(page)

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: /dashboard operacional/i })).toBeVisible()
  })

  test('exibe erro com senha incorreta', async ({ page }) => {
    await prepareE2EPage(page)

    await page.goto('/login')
    await page.locator('.auth-pin__key', { hasText: '0' }).click()
    await page.locator('.auth-pin__key', { hasText: '1' }).first().click()
    await page.locator('.auth-pin__key', { hasText: '0' }).click()
    await page.locator('.auth-pin__key', { hasText: '1' }).first().click()
    await expect(page.getByLabel('Operador')).toBeVisible()
    await page.getByLabel('Operador').selectOption('Gabriel')
    await page.getByLabel('Senha').fill('99')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText(/senha incorreta/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})
