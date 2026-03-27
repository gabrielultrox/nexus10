import type { Meta, StoryObj } from '@storybook/react'

import StatusBadge from './StatusBadge'
import Table from './Table'

type OrderRow = {
  id: string
  pedido: string
  cliente: string
  total: number
  status: string
}

const rows: OrderRow[] = [
  { id: '1', pedido: 'PED-2031', cliente: 'Cliente avulso', total: 18.9, status: 'aberto' },
  { id: '2', pedido: 'PED-2032', cliente: 'Gabriel', total: 42.5, status: 'despachado' },
  { id: '3', pedido: 'PED-2033', cliente: 'Joao', total: 13.0, status: 'cancelado' },
  { id: '4', pedido: 'PED-2034', cliente: 'Maria', total: 31.7, status: 'aberto' },
  { id: '5', pedido: 'PED-2035', cliente: 'Eduardo', total: 21.2, status: 'despachado' },
  { id: '6', pedido: 'PED-2036', cliente: 'Ana', total: 66.9, status: 'aberto' },
]

const columns = [
  { key: 'pedido', label: 'Pedido', sortable: true },
  { key: 'cliente', label: 'Cliente', sortable: true },
  {
    key: 'total',
    label: 'Total',
    sortable: true,
    render: (row: OrderRow) => `R$ ${row.total.toFixed(2).replace('.', ',')}`,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row: OrderRow) => <StatusBadge status={row.status} />,
  },
] satisfies React.ComponentProps<typeof Table<OrderRow>>['columns']

const meta = {
  title: 'UI/Table',
  component: Table<OrderRow>,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tabela base com ordenacao local e paginacao. Ideal para listas administrativas, detalhes financeiros e visoes operacionais simples.',
      },
    },
  },
  argTypes: {
    pageSize: {
      control: { type: 'number', min: 1, max: 20, step: 1 },
      description: 'Quantidade de linhas por pagina.',
    },
  },
} satisfies Meta<typeof Table<OrderRow>>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    columns,
    data: rows,
    pageSize: 4,
  },
}
