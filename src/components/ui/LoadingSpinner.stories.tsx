import type { Meta, StoryObj } from '@storybook/react'

import LoadingSpinner from './LoadingSpinner'

const meta = {
  title: 'UI/Loading/Spinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    color: {
      control: 'radio',
      options: ['inherit', 'primary', 'secondary'],
    },
  },
} satisfies Meta<typeof LoadingSpinner>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    size: 'md',
    color: 'primary',
  },
}

export const SecondaryLarge: Story = {
  args: {
    size: 'lg',
    color: 'secondary',
  },
}
