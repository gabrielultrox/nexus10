import { useEffect, useMemo, useRef, useState } from 'react'

import { formatCurrencyBRL, getChannelLabel, getPaymentMethodLabel } from '../../../services/commerce'

function normalizeSearchToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function buildOptionLabel(option, entityLabel) {
  const secondaryToken = option?.sku || option?.phoneDisplay || option?.phone || option?.category || ''
  return secondaryToken ? `${option?.name ?? entityLabel} - ${secondaryToken}` : `${option?.name ?? entityLabel}`
}

function findOptionBySearch(options, query, allowPartial = false) {
  const normalizedQuery = normalizeSearchToken(query)

  if (!normalizedQuery) {
    return null
  }

  const exactMatch = options.find((option) => {
    const nameToken = normalizeSearchToken(option.name)
    const secondaryToken = normalizeSearchToken(option.sku || option.phoneDisplay || option.phone)
    const labelToken = normalizeSearchToken(buildOptionLabel(option))
    return nameToken === normalizedQuery || secondaryToken === normalizedQuery || labelToken === normalizedQuery
  })

  if (exactMatch || !allowPartial) {
    return exactMatch ?? null
  }

  const partialMatches = options.filter((option) => {
    const haystack = [
      option.name,
      option.category,
      option.sku,
      option.barcode,
      option.phoneDisplay,
      option.phone,
      option.neighborhood,
    ]
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return haystack.includes(normalizedQuery)
  })

  return partialMatches[0] ?? null
}

function SearchSelectField({
  options,
  value,
  inputRef,
  onChange,
  onKeyDown,
  entityLabel = 'Item',
  placeholder,
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const closeTimeoutRef = useRef(null)
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  )
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchToken(query)

    if (!normalizedQuery) {
      return options.slice(0, 8)
    }

    return options.filter((option) => {
      const haystack = [
        option.name,
        option.category,
        option.sku,
        option.barcode,
        option.phoneDisplay,
        option.phone,
        option.neighborhood,
      ]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      return haystack.includes(normalizedQuery)
    }).slice(0, 8)
  }, [options, query])

  useEffect(() => {
    const nextQuery = selectedOption ? buildOptionLabel(selectedOption, entityLabel) : ''
    setQuery((current) => (current === nextQuery ? current : nextQuery))
  }, [entityLabel, selectedOption])

  useEffect(() => () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  function commitSelection(nextQuery, { allowPartial = false } = {}) {
    const option = findOptionBySearch(options, nextQuery, allowPartial)

    if (option) {
      onChange(option.id)
      setQuery(buildOptionLabel(option, entityLabel))
      return option
    }

    if (!nextQuery.trim()) {
      onChange('')
      setQuery('')
    }

    return null
  }

  return (
    <div className="commerce-product-search">
      <input
        ref={inputRef}
        className="ui-input commerce-product-search__input"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value
          setQuery(nextValue)
          setIsOpen(true)
          const exactOption = findOptionBySearch(options, nextValue)
          onChange(exactOption?.id ?? '')
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          closeTimeoutRef.current = window.setTimeout(() => {
            commitSelection(query, { allowPartial: true })
            setIsOpen(false)
          }, 120)
        }}
        onKeyDown={onKeyDown}
      />

      {isOpen && filteredOptions.length > 0 ? (
        <div className="commerce-product-search__panel">
          {filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`commerce-product-search__option${option.id === value ? ' commerce-product-search__option--active' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                if (closeTimeoutRef.current) {
                  window.clearTimeout(closeTimeoutRef.current)
                }
                onChange(option.id)
                setQuery(buildOptionLabel(option, entityLabel))
                setIsOpen(false)
              }}
            >
              <span>{option.name}</span>
              <small>{[option.sku, option.phoneDisplay || option.phone, option.category].filter(Boolean).join(' - ') || 'Sem classificacao'}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function CommerceIdentitySection({
  eyebrow,
  title,
  channelId,
  channelLabel = 'Canal',
  channelField,
  channelValue,
  channelOptions,
  customerFieldId,
  customerValue,
  customers,
  paymentId,
  paymentValue,
  paymentOptions,
  onFieldChange,
  onCustomerChange,
}) {
  return (
    <div className="entity-form-section commerce-panel commerce-panel--identity">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <p className="entity-form-section__title">{title}</p>
      </div>

      <div className="entity-stack">
        <div className="ui-field">
          <label className="ui-label" htmlFor={channelId}>{channelLabel}</label>
          <select id={channelId} className="ui-select" value={channelValue} onChange={(event) => onFieldChange(channelField, event.target.value)}>
            {channelOptions.map((channel) => (
              <option key={channel} value={channel}>{getChannelLabel(channel)}</option>
            ))}
          </select>
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={customerFieldId}>Cliente</label>
          <SearchSelectField
            options={[{ id: '', name: 'Cliente avulso', phoneDisplay: '' }, ...customers]}
            value={customerValue}
            onChange={onCustomerChange}
            entityLabel="Cliente"
            placeholder="Buscar cliente"
          />
        </div>

        <div className="ui-field">
          <label className="ui-label" htmlFor={paymentId}>Forma de pagamento</label>
          <select id={paymentId} className="ui-select" value={paymentValue} onChange={(event) => onFieldChange('paymentMethod', event.target.value)}>
            {paymentOptions.map((paymentMethod) => (
              <option key={paymentMethod} value={paymentMethod}>{getPaymentMethodLabel(paymentMethod)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export function CommerceItemsSection(props) {
  return <CommerceItemsStep {...props} />
}

export function CommerceItemsStep({
  eyebrow,
  title,
  items,
  products,
  draftItems,
  onItemChange,
  onRemoveItem,
  onAddItem,
  onAdvance,
  hasValidItems,
  subtotal,
}) {
  const productRefs = useRef([])
  const quantityRef = useRef(null)
  const unitPriceRef = useRef(null)
  const discountRef = useRef(null)
  const addButtonRef = useRef(null)
  const pendingFocusIndex = useRef(null)
  const queuedEditItemRef = useRef(null)
  const didInitialFocus = useRef(false)
  const currentItemIndex = Math.max(items.length - 1, 0)
  const currentItem = items[currentItemIndex] ?? {}
  const validItems = draftItems.map((item, index) => ({ ...item, itemIndex: index })).filter((item) => item.productId)

  useEffect(() => {
    if (!didInitialFocus.current) {
      productRefs.current[0]?.focus()
      didInitialFocus.current = true
    }
  }, [])

  useEffect(() => {
    if (pendingFocusIndex.current == null && !queuedEditItemRef.current) {
      return
    }

    const nextFrame = window.requestAnimationFrame(() => {
      if (queuedEditItemRef.current) {
        const { index, item } = queuedEditItemRef.current
        onItemChange(index, 'productId', item.productId)
        onItemChange(index, 'quantity', String(item.quantity ?? 1))
        onItemChange(index, 'unitPrice', String(item.unitPrice ?? ''))
        onItemChange(index, 'discountPercent', String(item.discountPercent ?? 0))
        queuedEditItemRef.current = null
      }

      if (pendingFocusIndex.current != null) {
        productRefs.current[pendingFocusIndex.current]?.focus()
        pendingFocusIndex.current = null
      }
    })

    return () => window.cancelAnimationFrame(nextFrame)
  }, [items.length, onItemChange])

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'F12' && hasValidItems) {
        event.preventDefault()
        onAdvance()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [hasValidItems, onAdvance])

  function focusCurrentProduct(index = currentItemIndex) {
    productRefs.current[index]?.focus()
  }

  function focusNextRequiredField(item = currentItem) {
    if (!item.productId) {
      focusCurrentProduct()
      return true
    }

    if (!(Number(item.quantity) > 0)) {
      quantityRef.current?.focus()
      return true
    }

    if (!(Number(item.unitPrice) > 0)) {
      unitPriceRef.current?.focus()
      return true
    }

    return false
  }

  function commitCurrentLine() {
    if (currentItem.productId && Number(currentItem.unitPrice) > 0) {
      pendingFocusIndex.current = currentItemIndex + 1
      onAddItem()
      return true
    }

    if (!focusNextRequiredField()) {
      focusCurrentProduct()
    }

    return false
  }

  function moveFocusWithinEntry(field, backwards = false) {
    const focusMap = {
      product: () => focusCurrentProduct(),
      quantity: () => quantityRef.current?.focus(),
      price: () => unitPriceRef.current?.focus(),
      discount: () => discountRef.current?.focus(),
      add: () => addButtonRef.current?.focus(),
    }
    const nextField = backwards
      ? { add: 'price', price: 'quantity', discount: 'price', quantity: 'product', product: 'add' }[field]
      : { product: 'quantity', quantity: 'price', price: 'add', discount: 'add' }[field]

    if (!backwards && field === 'add') {
      if (!commitCurrentLine()) {
        focusCurrentProduct()
      }
      return
    }

    focusMap[nextField]?.()
  }

  function handleEntryKeyDown(field) {
    return (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitCurrentLine()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        moveFocusWithinEntry(field, event.shiftKey)
      }
    }
  }

  function handleEditItem(item) {
    if (item.itemIndex === currentItemIndex) {
      focusCurrentProduct()
      return
    }

    const currentLineReady = currentItem.productId && Number(currentItem.unitPrice) > 0
    const targetIndex = currentLineReady ? currentItemIndex + 1 : currentItemIndex

    if (currentLineReady) {
      pendingFocusIndex.current = targetIndex
      queuedEditItemRef.current = { index: targetIndex, item }
      onAddItem()
    } else {
      queuedEditItemRef.current = { index: targetIndex, item }
      pendingFocusIndex.current = targetIndex
      onItemChange(targetIndex, 'productId', item.productId)
    }

    onRemoveItem(item.itemIndex)
  }

  return (
    <section className="commerce-step commerce-step--items">
      <div className="entity-form-section commerce-panel commerce-panel--items">
        <div className="entity-form-section__header">
          <span className="entity-form-section__eyebrow">{eyebrow}</span>
          <p className="entity-form-section__title">{title}</p>
        </div>

        <div className="commerce-step__input-row">
          <SearchSelectField
            inputRef={(element) => { productRefs.current[currentItemIndex] = element }}
            options={products}
            value={currentItem.productId ?? ''}
            onChange={(productId) => onItemChange(currentItemIndex, 'productId', productId)}
            entityLabel="Produto"
            placeholder="Buscar produto"
            onKeyDown={handleEntryKeyDown('product')}
          />
          <input ref={quantityRef} className="ui-input" type="number" min="1" step="1" placeholder="Qtd" value={currentItem.quantity ?? ''} onChange={(event) => onItemChange(currentItemIndex, 'quantity', event.target.value)} onKeyDown={handleEntryKeyDown('quantity')} />
          <input ref={unitPriceRef} className="ui-input" type="number" min="0" step="0.01" placeholder="Valor" value={currentItem.unitPrice ?? ''} onChange={(event) => onItemChange(currentItemIndex, 'unitPrice', event.target.value)} onKeyDown={handleEntryKeyDown('price')} />
          <input ref={discountRef} className="ui-input" type="number" min="0" step="0.01" placeholder="Desc. %" value={currentItem.discountPercent ?? ''} onChange={(event) => onItemChange(currentItemIndex, 'discountPercent', event.target.value)} onKeyDown={handleEntryKeyDown('discount')} tabIndex={-1} />
          <div className="commerce-step__line-total">
            <span>Total</span>
            <strong>{formatCurrencyBRL(draftItems[currentItemIndex]?.totalPrice ?? 0)}</strong>
          </div>
          <button ref={addButtonRef} type="button" className="ui-button ui-button--primary commerce-step__add-button" onClick={commitCurrentLine} onKeyDown={handleEntryKeyDown('add')}>
            +
          </button>
        </div>
      </div>

      <div className="commerce-step__item-list">
        <div className="commerce-step__item-row commerce-step__item-row--header">
          <strong>Produto</strong>
          <strong>Qtd</strong>
          <strong>Preco unit.</strong>
          <strong>Desconto</strong>
          <strong>Total</strong>
          <span />
        </div>

        {validItems.length === 0 ? (
          <div className="commerce-step__empty">Adicione pelo menos um item para continuar.</div>
        ) : (
          validItems.map((item) => (
            <div key={`${item.productId}-${item.itemIndex}`} className="commerce-step__item-row">
              <div className="commerce-step__item-main">
                <span>{item.productSnapshot?.name ?? item.product?.name ?? 'Produto'}</span>
                <small>{item.product?.category ?? item.productSnapshot?.category ?? 'Sem categoria'}</small>
              </div>
              <span>{item.quantity}</span>
              <span>{formatCurrencyBRL(item.unitPrice)}</span>
              <span>{Number(item.discountPercent ?? 0)}%</span>
              <strong>{formatCurrencyBRL(item.totalPrice ?? 0)}</strong>
              <div className="commerce-step__item-actions">
                <button type="button" className="ui-button ui-button--ghost commerce-step__edit-button" onClick={() => handleEditItem(item)}>
                  Editar
                </button>
                <button type="button" className="ui-button ui-button--danger commerce-step__remove-button" onClick={() => onRemoveItem(item.itemIndex)}>
                  x
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="commerce-step__footer">
        <div className="commerce-step__subtotal">Subtotal: {formatCurrencyBRL(subtotal)}</div>
        <button type="button" className="ui-button ui-button--primary" disabled={!hasValidItems} onClick={onAdvance}>
          Avancar {'->'}
        </button>
      </div>
    </section>
  )
}

export function CommerceAddressSection({
  eyebrow,
  title,
  itemPrefix,
  address,
  notes,
  onAddressChange,
  onFieldChange,
}) {
  return (
    <div className="entity-form-section entity-form-section--span-2 commerce-panel">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <p className="entity-form-section__title">{title}</p>
      </div>

      <div className="entity-stack">
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-neighborhood`}>Bairro</label>
          <input id={`${itemPrefix}-neighborhood`} className="ui-input" value={address.neighborhood} onChange={(event) => onAddressChange('neighborhood', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-address`}>Endereco</label>
          <input id={`${itemPrefix}-address`} className="ui-input" value={address.addressLine} onChange={(event) => onAddressChange('addressLine', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-reference`}>Referencia</label>
          <input id={`${itemPrefix}-reference`} className="ui-input" value={address.reference} onChange={(event) => onAddressChange('reference', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-complement`}>Complemento</label>
          <input id={`${itemPrefix}-complement`} className="ui-input" value={address.complement} onChange={(event) => onAddressChange('complement', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-notes`}>Observacoes</label>
          <textarea id={`${itemPrefix}-notes`} className="ui-textarea" rows={4} value={notes} onChange={(event) => onFieldChange('notes', event.target.value)} />
        </div>
      </div>
    </div>
  )
}

export function CommerceTotalsSection({
  eyebrow,
  title,
  itemPrefix,
  domainClassName,
  totals,
  calculatedTotals,
  onTotalsChange,
}) {
  return (
    <div className="entity-form-section entity-form-section--span-2 commerce-panel commerce-panel--totals">
      <div className="entity-form-section__header">
        <span className="entity-form-section__eyebrow">{eyebrow}</span>
        <p className="entity-form-section__title">{title}</p>
      </div>

      <div className={`${domainClassName}__totals-grid`}>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-freight`}>Frete</label>
          <input id={`${itemPrefix}-freight`} className="ui-input" type="number" min="0" step="0.01" value={totals.freight} onChange={(event) => onTotalsChange('freight', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-extra`}>Adicional</label>
          <input id={`${itemPrefix}-extra`} className="ui-input" type="number" min="0" step="0.01" value={totals.extraAmount} onChange={(event) => onTotalsChange('extraAmount', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-discount-percent`}>Desconto (%)</label>
          <input id={`${itemPrefix}-discount-percent`} className="ui-input" type="number" min="0" step="0.01" value={totals.discountPercent} onChange={(event) => onTotalsChange('discountPercent', event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor={`${itemPrefix}-discount-value`}>Desconto (R$)</label>
          <input id={`${itemPrefix}-discount-value`} className="ui-input" type="number" min="0" step="0.01" value={totals.discountValue} onChange={(event) => onTotalsChange('discountValue', event.target.value)} />
        </div>
      </div>

      <div className={`${domainClassName}__summary`}>
        <div className={`${domainClassName}__summary-row`}><span>Subtotal</span><strong>{formatCurrencyBRL(calculatedTotals.subtotal)}</strong></div>
        <div className={`${domainClassName}__summary-row`}><span>Frete</span><strong>{formatCurrencyBRL(calculatedTotals.freight)}</strong></div>
        <div className={`${domainClassName}__summary-row`}><span>Adicional</span><strong>{formatCurrencyBRL(calculatedTotals.extraAmount)}</strong></div>
        <div className={`${domainClassName}__summary-row`}><span>Desconto</span><strong>{formatCurrencyBRL(calculatedTotals.discountValue)}</strong></div>
        <div className={`${domainClassName}__summary-row ${domainClassName}__summary-row--total`}><span>Total final</span><strong>{formatCurrencyBRL(calculatedTotals.total)}</strong></div>
      </div>
    </div>
  )
}

export function CommerceFinishStep({
  identityProps,
  addressProps,
  totalsProps,
  summaryItems,
  totalFinal,
}) {
  return (
    <section className="commerce-step commerce-step--finish">
      <div className="commerce-step__finish-grid">
        <div className="entity-stack">
          <CommerceIdentitySection {...identityProps} />
          <CommerceAddressSection {...addressProps} />
        </div>

        <div className="entity-stack">
          <CommerceTotalsSection {...totalsProps} />
          <div className="entity-form-section commerce-panel commerce-panel--summary">
            <div className="entity-form-section__header">
              <span className="entity-form-section__eyebrow">Resumo</span>
              <p className="entity-form-section__title">Itens da operacao</p>
            </div>

            <div className="entity-stack">
              {summaryItems.map((item) => (
                <div key={`${item.productId}-${item.itemIndex}`} className="commerce-step__summary-item">
                  <div className="commerce-step__summary-copy">
                    <span>{item.name}</span>
                    <small>{item.quantity} x {formatCurrencyBRL(item.unitPrice)}</small>
                  </div>
                  <strong>{formatCurrencyBRL(item.totalPrice)}</strong>
                </div>
              ))}
              <div className="commerce-step__total-final">
                <span>Total final</span>
                <strong>{formatCurrencyBRL(totalFinal)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
