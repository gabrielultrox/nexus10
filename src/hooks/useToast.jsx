import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import Toast from '../components/ui/Toast'

const ToastContext = createContext(null)

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function ToastProvider({ children }) {
  const timeoutMapRef = useRef(new Map())
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((toastId) => {
    const timeoutId = timeoutMapRef.current.get(toastId)

    if (timeoutId) {
      clearTimeout(timeoutId)
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
    ({ message, variant = 'info', duration = 3000 }) => {
      const toastId = createToastId()
      const nextToast = { id: toastId, message, variant, visible: true }

      setToasts((currentToasts) => [...currentToasts, nextToast])

      const timeoutId = window.setTimeout(() => {
        removeToast(toastId)
      }, duration)

      timeoutMapRef.current.set(toastId, timeoutId)
      return toastId
    },
    [removeToast],
  )

  const value = useMemo(
    () => ({
      pushToast,
      success(message, options = {}) {
        return pushToast({ message, variant: 'success', ...options })
      },
      error(message, options = {}) {
        return pushToast({ message, variant: 'error', ...options })
      },
      warning(message, options = {}) {
        return pushToast({ message, variant: 'warning', ...options })
      },
      info(message, options = {}) {
        return pushToast({ message, variant: 'info', ...options })
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

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider')
  }

  return context
}
