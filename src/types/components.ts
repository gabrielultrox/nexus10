import type { ButtonHTMLAttributes, FormEvent, MouseEventHandler, ReactNode } from 'react'

export interface IBaseComponentProps {
  children?: ReactNode
  className?: string
  testId?: string
}

export interface IErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: unknown) => void
  resetKey?: string | number
}

export interface IModalProps extends IBaseComponentProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, IBaseComponentProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export interface IFormProps<TValues = Record<string, unknown>> extends IBaseComponentProps {
  onSubmit: (event: FormEvent<HTMLFormElement>, values?: TValues) => void | Promise<void>
  validation?: (values: TValues) => boolean | Promise<boolean>
}

export interface ITableColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  width?: number | string
}

export interface ITableProps<T> extends IBaseComponentProps {
  columns: Array<ITableColumn<T>>
  data: T[]
  loading?: boolean
  onRowClick?: (row: T) => void
}

export interface IToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
  action?: {
    label: string
    onClick: MouseEventHandler<HTMLButtonElement>
  }
}
