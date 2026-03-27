import { createPortal } from 'react-dom'
import { useId } from 'react'

import Button from './Button'
import type { IModalProps } from './types'

function Modal({
  open,
  title,
  description,
  children,
  footer = null,
  closeLabel = 'Fechar',
  showCloseButton = true,
  onClose,
}: IModalProps) {
  const titleId = useId()
  const descriptionId = useId()

  if (!open) {
    return null
  }

  return createPortal(
    <div className="ui-modal-overlay" role="presentation">
      <div className="ui-modal-overlay__backdrop" onClick={onClose} />
      <section
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={String(titleId)}
        aria-describedby={description ? String(descriptionId) : undefined}
      >
        <header className="ui-modal__header">
          <div className="ui-modal__header-copy">
            <h2 id={String(titleId)} className="ui-modal__title">
              {title}
            </h2>
            {description ? (
              <p id={String(descriptionId)} className="ui-modal__description">
                {description}
              </p>
            ) : null}
          </div>
          {showCloseButton ? (
            <button
              type="button"
              className="ui-modal__close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </header>
        <div className="ui-modal__body">{children}</div>
        <footer className="ui-modal__footer">
          {footer ?? (
            <Button variant="secondary" onClick={onClose}>
              {closeLabel}
            </Button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

export default Modal
