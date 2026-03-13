import { useEffect, useRef, useState } from 'react'

import {
  CommerceFinishStep,
  CommerceItemsStep,
} from '../../commerce/components/CommerceFormSections'
import { channelOptions, paymentOptions } from './salesModuleHelpers'

function SalesFormPanel({
  canWrite,
  customers,
  products,
  formState,
  saving,
  draftItems,
  calculatedTotals,
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
  }, [])

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

      if (event.key === 'Enter' && event.ctrlKey && canWrite && !saving && hasValidItems) {
        event.preventDefault()
        formRef.current?.requestSubmit()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [canWrite, hasValidItems, saving, step])

  return (
    <div className="sales-domain__detail-shell">
      <div className="sales-domain__detail-header">
        <div>
          <p className="text-section-title">Nova Venda</p>
        </div>
      </div>

      <div className="commerce-wizard">
        {step === 1 ? (
          <CommerceItemsStep
            eyebrow="Itens"
            title="Monte a venda"
            items={formState.items}
            products={products}
            draftItems={draftItems}
            itemPrefix="sale"
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
                eyebrow: 'Finalizacao',
                title: 'Cliente, canal e pagamento',
                channelId: 'sale-channel',
                channelField: 'channel',
                channelValue: formState.channel,
                channelOptions,
                customerFieldId: 'sale-customer',
                customerValue: formState.customerId,
                customers,
                paymentId: 'sale-payment-method',
                paymentValue: formState.paymentMethod,
                paymentOptions,
                onFieldChange,
                onCustomerChange,
              }}
              addressProps={{
                eyebrow: 'Entrega',
                title: 'Endereco e observacoes',
                itemPrefix: 'sale',
                address: formState.address,
                notes: formState.notes,
                onAddressChange,
                onFieldChange,
              }}
              totalsProps={{
                eyebrow: 'Totais',
                title: 'Frete, adicional e descontos',
                itemPrefix: 'sale',
                domainClassName: 'sales-domain',
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
                  {saving ? 'Lancando...' : 'Lancar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default SalesFormPanel
