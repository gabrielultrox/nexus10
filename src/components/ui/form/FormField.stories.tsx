import type { Meta, StoryObj } from '@storybook/react'

import Input from './Input'
import FormField from './FormField'

const meta = {
  title: 'UI/Form/FormField',
  component: FormField,
  parameters: { layout: 'centered' },
  args: {
    children: null,
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <FormField {...args}>
        <Input placeholder="Digite aqui" />
      </FormField>
    </div>
  ),
} satisfies Meta<typeof FormField>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Campo base',
    hint: 'Hint opcional com contexto operacional.',
    required: true,
  },
}

export const Error: Story = {
  args: {
    label: 'Campo com erro',
    error: 'Preencha este campo antes de continuar.',
  },
}
