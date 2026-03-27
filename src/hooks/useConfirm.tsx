import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import ConfirmDialog from '../components/ui/ConfirmDialog'

export type ConfirmTone = 'danger' | 'warning'

export interface IConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

interface IConfirmDialogState extends Required<IConfirmOptions> {
  resolve: (confirmed: boolean) => void
}

export interface IConfirmApi {
  ask: (options: IConfirmOptions) => Promise<boolean>
  confirm: (messageOrOptions: string | IConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<IConfirmApi | null>(null)

const DEFAULT_OPTIONS: Required<Omit<IConfirmDialogState, 'resolve'>> = {
  title: 'Confirmar acao',
  message: 'Tem certeza que deseja continuar?',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
}

/**
 * Provider para fluxos assíncronos de confirmação.
 */
export function ConfirmProvider({ children }: PropsWithChildren) {
  const [dialogState, setDialogState] = useState<IConfirmDialogState | null>(null)

  const ask = useCallback(
    (options: IConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialogState({
          ...DEFAULT_OPTIONS,
          ...options,
          resolve,
        })
      }),
    [],
  )

  const confirm = useCallback(
    (messageOrOptions: string | IConfirmOptions) =>
      ask(
        typeof messageOrOptions === 'string'
          ? {
              message: messageOrOptions,
            }
          : messageOrOptions,
      ),
    [ask],
  )

  const closeDialog = useCallback((confirmed: boolean) => {
    setDialogState((current) => {
      if (!current) {
        return current
      }

      current.resolve(Boolean(confirmed))
      return null
    })
  }, [])

  const value = useMemo<IConfirmApi>(() => ({ ask, confirm }), [ask, confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(dialogState)}
        title={dialogState?.title ?? DEFAULT_OPTIONS.title}
        message={dialogState?.message ?? DEFAULT_OPTIONS.message}
        confirmLabel={dialogState?.confirmLabel ?? DEFAULT_OPTIONS.confirmLabel}
        cancelLabel={dialogState?.cancelLabel ?? DEFAULT_OPTIONS.cancelLabel}
        tone={dialogState?.tone ?? DEFAULT_OPTIONS.tone}
        onCancel={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
      />
    </ConfirmContext.Provider>
  )
}

/**
 * Hook tipado para confirmações modais.
 */
export function useConfirm(): IConfirmApi {
  const context = useContext(ConfirmContext)

  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider')
  }

  return context
}
