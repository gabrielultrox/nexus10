import { useEffect, useRef, useState } from 'react'

import {
  CommerceFinishStep,
  CommerceItemsStep,
} from '../../commerce/components/CommerceFormSections'

function OrderFormPanel({
  canWrite,
  editingOrderId,
  customers,
  products,
  formState,
  saving,
  draftItems,
  calculatedTotals,
  sourceOptions,
  paymentOptions,
  onCancel,
  onSubmit,
  onCustomerChange,
  onFieldChange,
  onAddressChange,
  onTotalsChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
}) {
  const [step, setStep] = useState(1)
  const formRef = useRef(null)
  const hasValidItems = draftItems.some((item) => item.productId && Number(item.unitPrice) > 0)
  const summaryItems = draftItems
    .map((item, index) => ({
      ...item,
      itemIndex: index,
      name: item.productSnapshot?.name ?? item.name ?? 'Produto',
    }))
    .filter((item) => item.productId)

  useEffect(() => {
    setStep(1)
  }, [editingOrderId])

  useEffect(() => {
    if (step !== 2) {
      return undefined
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setStep(1)
        return
      }

      if ((event.key === 'Enter' && event.ctrlKey) || event.key === 'F10') {
        if (!canWrite || saving || !hasValidItems) {
          return
        }
        event.preventDefault()
        formRef.current?.requestSubmit()
        return
      }

      if (event.key === 'F9') {
        event.preventDefault()
        setStep(1)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [canWrite, hasValidItems, saving, step])

  return (
    <div className="orders-domain__detail-shell">
      <div className="orders-domain__detail-header">
        <div>
          <p className="text-section-title">{editingOrderId ? 'Editar Pedido' : 'Novo Pedido'}</p>
        </div>
      </div>

      <div className="commerce-wizard">
        {step === 1 ? (
          <CommerceItemsStep
            eyebrow="Itens"
            title="Monte o pedido"
            items={formState.items}
            products={products}
            draftItems={draftItems}
            itemPrefix="order"
            onItemChange={onItemChange}
            onRemoveItem={onRemoveItem}
            onAddItem={onAddItem}
            subtotal={calculatedTotals.subtotal}
            hasValidItems={hasValidItems}
            onAdvance={() => setStep(2)}
          />
        ) : (
          <form ref={formRef} className="commerce-wizard__form" onSubmit={onSubmit}>
            <CommerceFinishStep
              identityProps={{
                eyebrow: 'Comercial',
                title: 'Canal, cliente e pagamento',
                channelId: 'order-source',
                channelField: 'source',
                channelValue: formState.source,
                channelOptions: sourceOptions,
                customerFieldId: 'order-customer',
                customerValue: formState.customerId,
                customers,
                paymentId: 'order-payment-method',
                paymentValue: formState.paymentMethod,
                paymentOptions,
                onFieldChange,
                onCustomerChange,
              }}
              addressProps={{
                eyebrow: 'Entrega',
                title: 'Endereco e observacoes',
                itemPrefix: 'order',
                address: formState.address,
                notes: formState.notes,
                onAddressChange,
                onFieldChange,
              }}
              totalsProps={{
                eyebrow: 'Totais',
                title: 'Frete, adicional e descontos',
                itemPrefix: 'order',
                domainClassName: 'orders-domain',
                totals: formState.totals,
                calculatedTotals,
                onTotalsChange,
              }}
              summaryItems={summaryItems}
              totalFinal={calculatedTotals.total}
            />

            <div className="commerce-step__footer">
              <button type="button" className="ui-button ui-button--ghost" onClick={() => setStep(1)}>
                Voltar
              </button>
              <div className="commerce-step__footer-actions">
                <button type="button" className="ui-button ui-button--ghost" onClick={onCancel}>
                  Cancelar
                </button>
                <button type="submit" className="ui-button ui-button--primary" disabled={saving || !canWrite}>
                  {saving ? 'Salvando...' : 'Lancar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default OrderFormPanel
