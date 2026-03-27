import type { Meta, StoryObj } from '@storybook/react'

import FileInput from './FileInput'

const meta = {
  title: 'UI/Form/FileInput',
  component: FileInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Anexe comprovantes e capturas',
    hint: 'Arraste ou clique para adicionar arquivos.',
  },
} satisfies Meta<typeof FileInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
