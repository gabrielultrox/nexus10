import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import Radio, { RadioGroup } from './Radio'

const meta = {
  title: 'UI/Form/Radio',
  component: Radio,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Radio>

export default meta

type Story = StoryObj<typeof meta>

export const Single: Story = {
  args: {
    label: 'Alta prioridade',
    checked: true,
  },
}

export const Group: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState('medium')
      return (
        <div style={{ width: 320 }}>
          <RadioGroup
            name="priority"
            value={value}
            onChange={setValue}
            options={[
              { label: 'Baixa', value: 'low' },
              { label: 'Media', value: 'medium' },
              { label: 'Alta', value: 'high' },
            ]}
          />
        </div>
      )
    }

    return <Demo />
  },
}
