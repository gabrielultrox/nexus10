import type { Meta, StoryObj } from '@storybook/react'

import ZeDeliveryLogs from './ZeDeliveryLogs'

const logs = [
  {
    id: 'run-1',
    storeId: 'loja-centro',
    createdAt: new Date().toISOString(),
    summary: {
      runId: 'manual-001',
      processed: 18,
      durationMs: 2400,
      success: true,
      trigger: 'manual',
    },
  },
  {
    id: 'run-2',
    storeId: 'loja-centro',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    summary: {
      runId: 'cron-002',
      processed: 0,
      durationMs: 1800,
      success: false,
      trigger: 'cron',
      error: {
        message: 'Timeout ao localizar o seletor da lista de entregas.',
        stack: 'Error: timeout\n    at scrapeDeliveries (...)',
      },
    },
  },
]

const meta = {
  title: 'Integrations/ZeDeliveryLogs',
  component: ZeDeliveryLogs,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ZeDeliveryLogs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    logs,
    onOpenDetails: () => {},
    onRetry: () => {},
    retryingLogId: null,
  },
}
