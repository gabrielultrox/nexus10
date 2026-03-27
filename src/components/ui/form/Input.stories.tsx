import type { Meta, StoryObj } from '@storybook/react'

import Input from './Input'

const meta = {
  title: 'UI/Form/Input',
  component: Input,
  parameters: { layout: 'centered' },
  args: {
    placeholder: 'Digite o valor',
  },
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Text: Story = {}

export const WithIcons: Story = {
  args: {
    leftIcon: <span>@</span>,
    rightIcon: <span>R$</span>,
  },
}

export const Error: Story = {
  args: {
    error: true,
    placeholder: 'Estado de erro',
  },
}
