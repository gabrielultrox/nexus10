import type { Meta, StoryObj } from '@storybook/react'

import Textarea from './Textarea'

const meta = {
  title: 'UI/Form/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  args: {
    placeholder: 'Descreva a ocorrencia',
    maxLength: 180,
    showCounter: true,
  },
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Error: Story = {
  args: {
    error: true,
    value: 'Texto com validacao de erro.',
  },
}
