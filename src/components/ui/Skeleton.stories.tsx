import type { Meta, StoryObj } from '@storybook/react'

import Skeleton from './Skeleton'

const meta = {
  title: 'UI/Loading/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['line', 'rect', 'circle'],
    },
    lines: {
      control: { type: 'number', min: 1, max: 6 },
    },
    pulse: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const Line: Story = {
  args: {
    variant: 'line',
    width: '100%',
    height: '14px',
  },
}

export const CardBlock: Story = {
  args: {
    variant: 'rect',
    height: '96px',
  },
}

export const Avatar: Story = {
  args: {
    variant: 'circle',
    width: '56px',
    height: '56px',
  },
}
