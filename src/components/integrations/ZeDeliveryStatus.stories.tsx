import type { Meta, StoryObj } from '@storybook/react'

import ZeDeliveryStatus from './ZeDeliveryStatus'

const meta = {
  title: 'Integrations/ZeDeliveryStatus',
  component: ZeDeliveryStatus,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ZeDeliveryStatus>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    storeId: 'loja-centro',
    summary: {
      status: 'idle',
      lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      nextSync: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      successRate: 0.985,
    },
    stats24h: {
      deliveriesSynced: 342,
      errors: 2,
      averageDurationMs: 2300,
      failureRate: 0.006,
      totalRuns: 48,
    },
    settings: {
      enabled: true,
      intervalMinutes: 10,
      notificationsEnabled: true,
      notificationWebhookUrl: 'https://hooks.example.com/ze-delivery',
    },
    onSyncNow: () => {},
    onToggleEnabled: () => {},
    onViewLogs: () => {},
  },
}
