import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import ConfirmDialog from '../components/ui/ConfirmDialog';

const ConfirmContext = createContext(null);

const DEFAULT_OPTIONS = {
  title: 'Confirmar acao',
  message: 'Tem certeza que deseja continuar?',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
};

export function ConfirmProvider({ children }) {
  const [dialogState, setDialogState] = useState(null);

  const ask = useCallback((options) => new Promise((resolve) => {
    setDialogState({
      ...DEFAULT_OPTIONS,
      ...options,
      resolve,
    });
  }), []);

  const closeDialog = useCallback((confirmed) => {
    setDialogState((current) => {
      if (!current) {
        return current;
      }

      current.resolve(Boolean(confirmed));
      return null;
    });
  }, []);

  const value = useMemo(() => ({ ask }), [ask]);

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
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  }

  return context;
}
