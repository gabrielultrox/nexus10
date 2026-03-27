import type { Meta, StoryObj } from '@storybook/react'

import Card from './Card'
import LoadingOverlay from './LoadingOverlay'

const meta = {
  title: 'UI/Loading/Overlay',
  component: LoadingOverlay,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', minHeight: '220px' }}>
        <Card>
          <Card.Body>
            <p className="story-title">Conteudo carregando</p>
            <p className="story-copy">Overlay centralizado sobre a superficie.</p>
          </Card.Body>
        </Card>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoadingOverlay>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    active: true,
    backdrop: false,
    children: 'Sincronizando modulo',
  },
}

export const WithBackdrop: Story = {
  args: {
    active: true,
    backdrop: true,
    children: 'Carregando pagina',
  },
}
