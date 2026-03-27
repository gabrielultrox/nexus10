import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import Select from './Select'

const OPTIONS = [
  { label: 'Troco pendente', value: 'change', keywords: ['troco', 'dinheiro'] },
  { label: 'Estorno', value: 'refund', keywords: ['cancelamento'] },
  {
    label: 'Delivery',
    options: [
      { label: 'Erro do entregador', value: 'courier' },
      { label: 'Atraso de rota', value: 'delay' },
    ],
  },
]

const meta = {
  title: 'UI/Form/Select',
  component: Select,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Native: Story = {
  args: {
    placeholder: 'Selecione',
    options: OPTIONS,
    value: 'change',
  },
}

export const Searchable: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState('refund')
      return (
        <div style={{ width: 320 }}>
          <Select
            searchable
            placeholder="Buscar categoria"
            options={OPTIONS}
            value={value}
            onValueChange={setValue}
          />
        </div>
      )
    }

    return <Demo />
  },
}
