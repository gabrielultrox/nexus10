import { expect, test } from '@playwright/test'

import { prepareE2EPage } from './fixtures/app'

test.describe('Fluxo E2E - Notificacoes em tempo real', () => {
  test('entrega 2 eventos simultaneos e atualiza badge + centro operacional', async ({ page }) => {
    await prepareE2EPage(page, { authenticated: true })
    await page.goto('/dashboard')

    await page.evaluate(() => {
      const now = new Date().toISOString()
      const firstEvent = {
        id: 'e2e-live-order-1',
        type: 'order.created',
        title: 'Novo pedido recebido',
        message: 'Pedido PED-9001 entrou na fila.',
        severity: 'info',
        createdAt: now,
        metadata: {
          route: '/orders',
        },
      }
      const secondEvent = {
        id: 'e2e-live-cash-1',
        type: 'cash.critical',
        title: 'Caixa critico',
        message: 'Saldo do caixa abaixo do limite configurado.',
        severity: 'warning',
        createdAt: now,
        metadata: {
          route: '/cash',
        },
      }

      window.dispatchEvent(new CustomEvent('nexus10:e2e-live-notification', { detail: firstEvent }))
      window.dispatchEvent(new CustomEvent('nexus10:e2e-live-notification', { detail: secondEvent }))
    })

    await expect(page.locator('.sidebar__badge')).toHaveText('2')
    await page.getByLabel('Abrir notificacoes operacionais').click()
    await expect(page.getByText('Novo pedido recebido')).toBeVisible()
    await expect(page.getByText('Caixa critico')).toBeVisible()
    await expect(page.getByText('Tempo real ativo')).toBeVisible()
  })
})
