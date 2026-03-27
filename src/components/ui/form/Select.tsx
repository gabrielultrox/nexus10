import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react'

import type { IFormSelectProps, ISelectOption, ISelectOptionGroup } from './types'

function isOptionGroup(option: ISelectOption | ISelectOptionGroup): option is ISelectOptionGroup {
  return 'options' in option
}

function flattenOptions(options: Array<ISelectOption | ISelectOptionGroup>) {
  return options.flatMap((option) => (isOptionGroup(option) ? option.options : option))
}

const CHEVRON_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 6.5L8 10L12 6.5" />
  </svg>
)

const Select = forwardRef<HTMLSelectElement, IFormSelectProps>(function Select(
  {
    className = '',
    children,
    disabled = false,
    options,
    placeholder,
    searchable = false,
    searchPlaceholder = 'Buscar opcoes',
    onValueChange,
    onChange,
    error = false,
    value,
    name,
    id,
    ...props
  },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const listboxId = useId()

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handleClickOutside(event: MouseEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const supportsSearch = searchable && Boolean(options?.length)
  const flatOptions = useMemo(() => flattenOptions(options ?? []), [options])
  const filteredOptions = useMemo(() => {
    if (!supportsSearch || !query.trim()) {
      return flatOptions
    }

    const normalized = query.toLowerCase()
    return flatOptions.filter((option) => {
      const label = String(option.label).toLowerCase()
      const keywords = option.keywords?.join(' ').toLowerCase() ?? ''
      return label.includes(normalized) || keywords.includes(normalized)
    })
  }, [flatOptions, query, supportsSearch])

  useEffect(() => {
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [filteredOptions, value])

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus()
    } else {
      setQuery('')
    }
  }, [isOpen])

  const selectedOption = flatOptions.find((option) => option.value === value)
  const activeOption = filteredOptions[activeIndex]
  const labelledBy = props['aria-labelledby']

  function emitValue(nextValue: string) {
    onValueChange?.(nextValue)
    onChange?.({
      target: { value: nextValue, name },
    } as never as React.ChangeEvent<HTMLSelectElement>)
  }

  function closeDropdown() {
    setIsOpen(false)
    setQuery('')
  }

  function openDropdown() {
    if (disabled) {
      return
    }

    setIsOpen(true)
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openDropdown()
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((current) => !current)
    }

    if (event.key === 'Escape') {
      closeDropdown()
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(filteredOptions.length - 1, current + 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(0, current - 1))
      return
    }

    if (event.key === 'Enter' && activeOption && !activeOption.disabled) {
      event.preventDefault()
      emitValue(activeOption.value)
      closeDropdown()
      return
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      closeDropdown()
    }
  }

  if (!supportsSearch) {
    return (
      <span
        className={[
          'ui-select-shell',
          disabled ? 'is-disabled' : '',
          error ? 'is-error' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <select
          ref={ref}
          id={id}
          className="ui-select"
          disabled={disabled}
          value={value}
          name={name}
          onChange={(event) => {
            onValueChange?.(event.target.value)
            onChange?.(event)
          }}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options
            ? options.map((option) =>
                isOptionGroup(option) ? (
                  <optgroup key={String(option.label)} label={String(option.label)}>
                    {option.options.map((groupOption) => (
                      <option
                        key={groupOption.value}
                        value={groupOption.value}
                        disabled={groupOption.disabled}
                      >
                        {groupOption.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ),
              )
            : children}
        </select>
        <span className="ui-select-shell__icon">{CHEVRON_ICON}</span>
      </span>
    )
  }

  return (
    <div
      ref={shellRef}
      className={[
        'ui-search-select',
        disabled ? 'is-disabled' : '',
        error ? 'is-error' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        id={id}
        type="button"
        className="ui-search-select__trigger"
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={props['aria-label']}
        aria-labelledby={labelledBy}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        aria-activedescendant={
          isOpen && activeOption ? `${listboxId}-${activeOption.value}` : undefined
        }
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selectedOption ? '' : 'is-placeholder'}>
          {selectedOption?.label ?? placeholder ?? 'Selecione'}
        </span>
        <span className="ui-search-select__icon">{CHEVRON_ICON}</span>
      </button>
      {isOpen ? (
        <div className="ui-search-select__dropdown">
          <input
            ref={searchInputRef}
            type="search"
            className="ui-input ui-search-select__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={searchPlaceholder}
            role="searchbox"
            aria-controls={listboxId}
          />
          <div id={listboxId} className="ui-search-select__options" role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option, optionIndex) => (
                <button
                  key={option.value}
                  id={`${listboxId}-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={[
                    'ui-search-select__option',
                    option.value === value ? 'is-selected' : '',
                    optionIndex === activeIndex ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(optionIndex)}
                  onClick={() => {
                    emitValue(option.value)
                    closeDropdown()
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="ui-search-select__empty" role="status" aria-live="polite">
                Nenhuma opcao encontrada.
              </div>
            )}
          </div>
        </div>
      ) : null}
      <input type="hidden" name={name} value={value ?? ''} readOnly />
    </div>
  )
})

export default Select
