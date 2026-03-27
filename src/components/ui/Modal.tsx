import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import Button from './Button'
import type { IModalProps } from './types'

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return []
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function Modal({
  open,
  title,
  description,
  children,
  footer = null,
  closeLabel = 'Fechar',
  showCloseButton = true,
  closeOnEscape = true,
  initialFocusSelector,
  onClose,
}: IModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<Element | null>(null)
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setShouldRender(true)

      const frameId = window.requestAnimationFrame(() => {
        setIsVisible(true)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    setIsVisible(false)

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!open || !shouldRender) {
      return undefined
    }

    previousFocusRef.current = document.activeElement

    const dialogNode = dialogRef.current
    const initialTarget =
      (initialFocusSelector
        ? dialogNode?.querySelector<HTMLElement>(initialFocusSelector)
        : null) ?? getFocusableElements(dialogNode)[0]

    initialTarget?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(dialogNode)
      if (!focusableElements.length) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [closeOnEscape, initialFocusSelector, onClose, open, shouldRender])

  if (!shouldRender) {
    return null
  }

  return createPortal(
    <div
      className={[
        'ui-modal-overlay',
        isVisible ? 'is-visible motion-fade-enter' : 'is-exiting',
      ].join(' ')}
      data-state={isVisible ? 'open' : 'closed'}
      role="presentation"
    >
      <div className="ui-modal-overlay__backdrop" onClick={onClose} />
      <section
        ref={dialogRef}
        className={['ui-modal', isVisible ? 'motion-scale-enter' : 'ui-modal--closing'].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={String(titleId)}
        aria-describedby={description ? String(descriptionId) : undefined}
        tabIndex={-1}
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
              title={closeLabel}
              onClick={onClose}
            >
              <span aria-hidden="true">&times;</span>
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
