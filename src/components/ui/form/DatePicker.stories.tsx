import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import DatePicker from './DatePicker'

const meta = {
  title: 'UI/Form/DatePicker',
  component: DatePicker,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DatePicker>

export default meta

type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState('2026-03-27')
      return (
        <div style={{ width: 320 }}>
          <DatePicker value={value} onChange={(nextValue) => setValue(String(nextValue))} />
        </div>
      )
    }

    return <Demo />
  },
}

export const Range: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<{ start?: string; end?: string }>({
        start: '2026-03-27',
        end: '2026-03-30',
      })
      return (
        <div style={{ width: 320 }}>
          <DatePicker
            range
            value={value}
            onChange={(nextValue) => setValue(nextValue as typeof value)}
          />
        </div>
      )
    }

    return <Demo />
  },
}
