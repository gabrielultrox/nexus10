import PageIntro from '../components/common/PageIntro'
import CashModule from '../modules/cash/components/CashModule'

function FinancialPendingsPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Financeiro"
        title="Pendencias financeiras"
        description="Fila unica para trocos pendentes, estornos, cobrancas incorretas e ajustes do dia."
      />

      <CashModule mode="financial-pending" />
    </div>
  )
}

export default FinancialPendingsPage
