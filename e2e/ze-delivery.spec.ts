import { expect, test } from '@playwright/test'

import { prepareE2EPage, setE2EFailures } from './fixtures/app'

test.describe('Fluxo E2E - Ze Delivery', () => {
  test('carrega dashboard e executa sincronizacao manual', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })

    await page.goto('/integrations/ze-delivery')

    await expect(page.getByRole('heading', { name: 'Ze Delivery', exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Historico recente', exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/12/).first()).toBeVisible()

    await page.getByRole('button', { name: /sincronizar agora/i }).click()

    await expect(page.getByText(/sincronizacao ze delivery iniciada/i)).toBeVisible()
    await expect(page.getByRole('row', { name: /hora-dez 7 success 1.5s/i })).toBeVisible()
  })

  test('exibe erro recente quando a sincronizacao falha', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })
    await page.goto('/integrations/ze-delivery')
    await setE2EFailures(page, { zeDeliverySync: 1 })

    await page.getByRole('button', { name: /sincronizar agora/i }).click()

    await expect(page.getByText(/falha simulada na sincronizacao do ze delivery/i)).toBeVisible()
    await expect(page.getByText(/error/i).last()).toBeVisible()
  })
})
