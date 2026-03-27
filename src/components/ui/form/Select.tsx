import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'

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
    ...props
  },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shellRef = useRef<HTMLDivElement | null>(null)

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

  const selectedOption = flatOptions.find((option) => option.value === value)

  function emitValue(nextValue: string) {
    onValueChange?.(nextValue)
    onChange?.({
      target: { value: nextValue, name },
    } as never as React.ChangeEvent<HTMLSelectElement>)
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
        type="button"
        className="ui-search-select__trigger"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedOption ? '' : 'is-placeholder'}>
          {selectedOption?.label ?? placeholder ?? 'Selecione'}
        </span>
        <span className="ui-search-select__icon">{CHEVRON_ICON}</span>
      </button>
      {isOpen ? (
        <div className="ui-search-select__dropdown">
          <input
            type="search"
            className="ui-input ui-search-select__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
          <div className="ui-search-select__options">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'ui-search-select__option',
                    option.value === value ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={option.disabled}
                  onClick={() => {
                    emitValue(option.value)
                    setIsOpen(false)
                    setQuery('')
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="ui-search-select__empty">Nenhuma opcao encontrada.</div>
            )}
          </div>
        </div>
      ) : null}
      <input type="hidden" name={name} value={value ?? ''} readOnly />
    </div>
  )
})

export default Select
