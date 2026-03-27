import type { Meta, StoryObj } from '@storybook/react'

import Button from './Button'
import Card from './Card'

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Container base para blocos de conteudo. Os slots `Header`, `Body` e `Footer` mantem a hierarquia consistente entre modulos.',
      },
    },
  },
  argTypes: {
    interactive: {
      control: 'boolean',
      description: 'Liga estados de hover para cards clicaveis.',
    },
  },
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: (args) => (
    <Card {...args} style={{ maxWidth: 520 }}>
      <Card.Header>
        <div>
          <h3 className="story-title">Resumo do caixa</h3>
          <p className="story-copy">Card com cabecalho, corpo e rodape reutilizaveis.</p>
        </div>
      </Card.Header>
      <Card.Body>
        <p className="story-copy">
          Use este componente para blocos operacionais, resumos, detalhes de entidade e containers
          de acao.
        </p>
      </Card.Body>
      <Card.Footer>
        <Button variant="secondary">Ver detalhes</Button>
      </Card.Footer>
    </Card>
  ),
  args: {
    children: null,
    interactive: false,
  },
}
