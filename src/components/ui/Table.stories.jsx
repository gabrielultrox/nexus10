import StatusBadge from './StatusBadge'
import Table from './Table'

const rows = [
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
    render: (row) => `R$ ${row.total.toFixed(2).replace('.', ',')}`,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
]

const meta = {
  title: 'UI/Table',
  component: Table,
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
}

export default meta

export const Default = {
  args: {
    columns,
    data: rows,
    pageSize: 4,
  },
}
