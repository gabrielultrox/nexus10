import { useEffect, useMemo, useRef, useState } from 'react'

import type { IDatePickerProps, UIDatePickerValue } from './types'

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function parseDate(value?: string) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function formatDate(value?: string) {
  const parsed = parseDate(value)
  if (!parsed) {
    return ''
  }

  return parsed.toLocaleDateString('pt-BR')
}

function formatDateForValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function sameDay(left?: string, right?: string) {
  return Boolean(left && right && left === right)
}

function isBetween(date: string, start?: string, end?: string) {
  if (!start || !end) {
    return false
  }

  return date > start && date < end
}

function buildCalendarMonth(baseDate: Date) {
  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    return current
  })
}

function DatePicker({
  value,
  onChange,
  range = false,
  disabled = false,
  error = false,
  min,
  max,
  placeholder = 'Selecione uma data',
  className = '',
  ...props
}: IDatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const normalizedValue =
    typeof value === 'string' || !value ? { start: value ?? '', end: '' } : value
  const initialMonth = parseDate(normalizedValue.start) ?? new Date()
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const days = useMemo(() => buildCalendarMonth(visibleMonth), [visibleMonth])

  function emit(nextValue: UIDatePickerValue) {
    onChange?.(nextValue)
  }

  function canSelect(dateValue: string) {
    if (min && dateValue < min) {
      return false
    }
    if (max && dateValue > max) {
      return false
    }
    return true
  }

  function handleSelect(date: Date) {
    const dateValue = formatDateForValue(date)

    if (!canSelect(dateValue)) {
      return
    }

    if (!range) {
      emit(dateValue)
      setOpen(false)
      return
    }

    if (!normalizedValue.start || (normalizedValue.start && normalizedValue.end)) {
      emit({ start: dateValue, end: undefined })
      return
    }

    if (dateValue < normalizedValue.start) {
      emit({ start: dateValue, end: normalizedValue.start })
    } else {
      emit({ start: normalizedValue.start, end: dateValue })
    }
    setOpen(false)
  }

  const displayValue = range
    ? normalizedValue.start
      ? normalizedValue.end
        ? `${formatDate(normalizedValue.start)} - ${formatDate(normalizedValue.end)}`
        : `${formatDate(normalizedValue.start)} - ...`
      : ''
    : formatDate(normalizedValue.start)

  return (
    <div
      ref={rootRef}
      className={['ui-date-picker', error ? 'is-error' : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      <button
        type="button"
        className="ui-date-picker__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={displayValue ? '' : 'is-placeholder'}>{displayValue || placeholder}</span>
      </button>
      {open ? (
        <div className="ui-date-picker__popover">
          <div className="ui-date-picker__header">
            <button
              type="button"
              className="ui-date-picker__nav"
              onClick={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                )
              }
            >
              ‹
            </button>
            <strong className="ui-date-picker__title">
              {visibleMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </strong>
            <button
              type="button"
              className="ui-date-picker__nav"
              onClick={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                )
              }
            >
              ›
            </button>
          </div>
          <div className="ui-date-picker__weekdays">
            {WEEK_DAYS.map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="ui-date-picker__grid">
            {days.map((day) => {
              const dateValue = formatDateForValue(day)
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth()
              const selected =
                sameDay(dateValue, normalizedValue.start) || sameDay(dateValue, normalizedValue.end)
              const inRange = isBetween(dateValue, normalizedValue.start, normalizedValue.end)

              return (
                <button
                  key={dateValue}
                  type="button"
                  className={[
                    'ui-date-picker__day',
                    isCurrentMonth ? '' : 'is-outside',
                    selected ? 'is-selected' : '',
                    inRange ? 'is-in-range' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!canSelect(dateValue)}
                  onClick={() => handleSelect(day)}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DatePicker
