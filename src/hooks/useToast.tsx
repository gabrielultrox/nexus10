import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import Toast from '../components/ui/Toast'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface IToastOptions {
  duration?: number
}

export interface IToastRecord {
  id: string
  message: string
  variant: ToastVariant
  visible: boolean
}

export interface IToastApi {
  toast: (message: string, variant?: ToastVariant, options?: IToastOptions) => string
  pushToast: (payload: { message: string; variant?: ToastVariant; duration?: number }) => string
  success: (message: string, options?: IToastOptions) => string
  error: (message: string, options?: IToastOptions) => string
  warning: (message: string, options?: IToastOptions) => string
  info: (message: string, options?: IToastOptions) => string
  dismiss: (toastId: string) => void
}

const ToastContext = createContext<IToastApi | null>(null)

function createToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

/**
 * Provider centralizado para mensagens transitórias da UI.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const timeoutMapRef = useRef<Map<string, number>>(new Map())
  const [toasts, setToasts] = useState<IToastRecord[]>([])

  const removeToast = useCallback((toastId: string) => {
    const timeoutId = timeoutMapRef.current.get(toastId)

    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutMapRef.current.delete(toastId)
    }

    setToasts((currentToasts) =>
      currentToasts.map((toast) => (toast.id === toastId ? { ...toast, visible: false } : toast)),
    )

    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId))
    }, 150)
  }, [])

  const pushToast = useCallback(
    ({
      message,
      variant = 'info',
      duration = 3000,
    }: {
      message: string
      variant?: ToastVariant
      duration?: number
    }) => {
      const toastId = createToastId()
      const nextToast: IToastRecord = { id: toastId, message, variant, visible: true }

      setToasts((currentToasts) => [...currentToasts, nextToast])

      const timeoutId = window.setTimeout(() => {
        removeToast(toastId)
      }, duration)

      timeoutMapRef.current.set(toastId, timeoutId)
      return toastId
    },
    [removeToast],
  )

  const value = useMemo<IToastApi>(
    () => ({
      toast(message, variant = 'info', options = {}) {
        return pushToast({ message, variant, duration: options.duration })
      },
      pushToast({ message, variant = 'info', duration = 3000 }) {
        return pushToast({ message, variant, duration })
      },
      success(message, options = {}) {
        return pushToast({ message, variant: 'success', duration: options.duration })
      },
      error(message, options = {}) {
        return pushToast({ message, variant: 'error', duration: options.duration })
      },
      warning(message, options = {}) {
        return pushToast({ message, variant: 'warning', duration: options.duration })
      },
      info(message, options = {}) {
        return pushToast({ message, variant: 'info', duration: options.duration })
      },
      dismiss: removeToast,
    }),
    [pushToast, removeToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            variant={toast.variant}
            visible={toast.visible}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Hook tipado para emitir toasts de feedback.
 */
export function useToast(): IToastApi {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider')
  }

  return context
}
