import type { Meta, StoryObj } from '@storybook/react'

import Button from './Button'

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Botao base do design system. Use `primary` para CTA principal, `secondary` para acao secundaria e `danger` para acoes destrutivas.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'danger', 'ghost', 'warning'],
      description: 'Define a hierarquia visual do botao.',
    },
    disabled: {
      control: 'boolean',
      description: 'Bloqueia interacao e aplica estado desabilitado.',
    },
    children: {
      control: 'text',
      description: 'Conteudo textual do botao.',
    },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    children: 'Salvar alteracoes',
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Abrir detalhe',
    variant: 'secondary',
  },
}

export const Danger: Story = {
  args: {
    children: 'Excluir registro',
    variant: 'danger',
  },
}
