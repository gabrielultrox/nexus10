import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../ui'
import ZeDeliveryErrorModal from './ZeDeliveryErrorModal'

function StoryDemo() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir erro
      </Button>
      <ZeDeliveryErrorModal
        open={open}
        onClose={() => setOpen(false)}
        onRetry={() => setOpen(false)}
        log={{
          id: 'error-run',
          storeId: 'loja-centro',
          createdAt: new Date().toISOString(),
          summary: {
            runId: 'cron-error-001',
            processed: 0,
            durationMs: 1900,
            success: false,
            trigger: 'cron',
            error: {
              message: 'Falha ao autenticar no painel do Ze Delivery.',
              stack: 'Error: auth failed\n  at login (...)',
            },
          },
        }}
      />
    </>
  )
}

const meta = {
  title: 'Integrations/ZeDeliveryErrorModal',
  component: ZeDeliveryErrorModal,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ZeDeliveryErrorModal>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: false,
    log: null,
    onClose: () => {},
    onRetry: () => {},
  },
  render: () => <StoryDemo />,
}
