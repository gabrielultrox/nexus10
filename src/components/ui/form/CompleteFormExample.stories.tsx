import type { Meta, StoryObj } from '@storybook/react'

import CompleteFormExample from './CompleteFormExample'

const meta = {
  title: 'UI/Form/CompleteFormExample',
  component: CompleteFormExample,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CompleteFormExample>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
