import { Suspense, lazy } from 'react'

import PageIntro from '../components/common/PageIntro'
import EmptyState from '../components/ui/EmptyState'

const PosReportsModule = lazy(() => import('../modules/reports/components/PosReportsModule'))

function PosReportsPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="PDV"
        title="Relatorios do PDV"
        description="Leitura real da operacao comercial com vendas, pedidos, financeiro e estrutura pronta para exportacao CSV."
      />

      <Suspense fallback={<EmptyState message="Carregando relatorios..." />}>
        <PosReportsModule />
      </Suspense>
    </div>
  )
}

export default PosReportsPage
