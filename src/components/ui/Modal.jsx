import { createPortal } from 'react-dom'

import Button from './Button'

function Modal({
  open,
  title,
  description,
  children,
  footer = null,
  closeLabel = 'Fechar',
  showCloseButton = true,
  onClose,
}) {
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
        aria-labelledby="ui-modal-title"
        aria-describedby={description ? 'ui-modal-description' : undefined}
      >
        <header className="ui-modal__header">
          <div className="ui-modal__header-copy">
            <h2 id="ui-modal-title" className="ui-modal__title">
              {title}
            </h2>
            {description ? (
              <p id="ui-modal-description" className="ui-modal__description">
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
