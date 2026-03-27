import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

export type UIButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
export type UIButtonType = 'button' | 'submit' | 'reset'
export type UITableSortDirection = 'asc' | 'desc'

export interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
  variant?: UIButtonVariant
  type?: UIButtonType
}

export interface ICardSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
}

export interface ICardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
  interactive?: boolean
}

export interface IModalProps {
  open: boolean
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  closeLabel?: string
  showCloseButton?: boolean
  onClose: () => void
}

export interface ITableColumn<TData extends Record<string, unknown>> {
  key: Extract<keyof TData, string>
  label: ReactNode
  sortable?: boolean
  width?: CSSProperties['width']
  render?: (row: TData) => ReactNode
}

export interface ITableSortState<TData extends Record<string, unknown>> {
  key: Extract<keyof TData, string>
  direction: UITableSortDirection
}

export interface ITableProps<TData extends Record<string, unknown>> {
  columns: Array<ITableColumn<TData>>
  data: TData[]
  pageSize?: number
  emptyMessage?: ReactNode
  defaultSort?: ITableSortState<TData> | null
  getRowKey?: (row: TData, rowIndex: number) => string | number
}

export interface ISelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
  children: ReactNode
}

export interface IFormRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}
