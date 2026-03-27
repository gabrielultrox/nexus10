import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import Checkbox, { CheckboxGroup } from './Checkbox'

const meta = {
  title: 'UI/Form/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Single: Story = {
  args: {
    label: 'Cliente contatado',
    description: 'Marque quando houver retorno do atendimento.',
    defaultChecked: true,
  },
}

export const Indeterminate: Story = {
  args: {
    label: 'Checklist parcial',
    indeterminate: true,
  },
}

export const Group: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<string[]>(['finance'])
      return (
        <div style={{ width: 320 }}>
          <CheckboxGroup
            name="checkbox-demo"
            value={value}
            onChange={setValue}
            options={[
              { label: 'Financeiro', value: 'finance' },
              { label: 'Entregador', value: 'courier' },
              { label: 'Cliente', value: 'customer' },
            ]}
          />
        </div>
      )
    }

    return <Demo />
  },
}
