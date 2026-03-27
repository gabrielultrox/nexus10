import React from 'react'

import '../src/styles/reset.css'
import '../src/styles/tokens.css'
import '../src/styles/typography.css'
import '../src/styles/components.css'
import '../src/styles/global.css'

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#0e0e10' },
        { name: 'surface', value: '#18181b' },
        { name: 'light', value: '#fafafa' },
      ],
    },
    layout: 'centered',
  },
  decorators: [
    (Story) =>
      React.createElement(
        'div',
        {
          'data-theme': 'dark',
          style: {
            minHeight: '100vh',
            padding: '24px',
            background: 'var(--color-bg-page)',
            color: 'var(--color-text-primary)',
          },
        },
        React.createElement(Story),
      ),
  ],
}

export default preview
