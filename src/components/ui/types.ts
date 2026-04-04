import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ElementType,
  HTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

export type UIButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
export type UIButtonType = 'button' | 'submit' | 'reset'
export type UITableSortDirection = 'asc' | 'desc'

export interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
  className?: string
  variant?: UIButtonVariant
  type?: UIButtonType
  loading?: boolean
  loadingLabel?: string
}

export interface ICardSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
}

export interface ICardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
  interactive?: boolean
  as?: ElementType
}

export interface IModalProps {
  open: boolean
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  closeLabel?: string
  showCloseButton?: boolean
  closeOnEscape?: boolean
  initialFocusSelector?: string
  onClose: () => void
}

export interface ITableColumn<TData extends Record<string, unknown>> {
  key: Extract<keyof TData, string>
  label: ReactNode
  sortable?: boolean
  width?: CSSProperties['width']
  render?: (row: TData) => ReactNode
  headerAriaLabel?: string
}

export interface ITableSortState<TData extends Record<string, unknown>> {
  key: Extract<keyof TData, string>
  direction: UITableSortDirection
}

export interface ITableProps<TData extends Record<string, unknown>> {
  columns: Array<ITableColumn<TData>>
  data: TData[]
  pageSize?: number
  paginate?: boolean
  emptyMessage?: ReactNode
  caption?: ReactNode
  defaultSort?: ITableSortState<TData> | null
  getRowKey?: (row: TData, rowIndex: number) => string | number
  getRowClassName?: (row: TData, rowIndex: number) => string | undefined
  getRowStyle?: (row: TData, rowIndex: number) => CSSProperties | undefined
  onRowClick?: (row: TData, rowIndex: number) => void
  isLoading?: boolean
  loadingRowCount?: number
}

export interface ISelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
  children: ReactNode
}

export interface IFormRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}
