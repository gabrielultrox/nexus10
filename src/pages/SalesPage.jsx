import { useLocation, useNavigate, useParams } from 'react-router-dom'

import PageTabs from '../components/common/PageTabs'
import SalesModule from '../modules/sales/components/SalesModule'

function SalesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { saleId } = useParams()
  const isNew = location.pathname === '/sales/new'
  const viewMode = isNew ? 'create' : saleId ? 'detail' : 'list'
  const salesTabs = [
    { id: 'list', label: 'Lista de vendas' },
    { id: 'form', label: 'Nova venda' },
    ...(saleId ? [{ id: 'detail', label: 'Detalhe da venda' }] : []),
  ]
  const activeTab = viewMode === 'list' ? 'list' : viewMode === 'create' ? 'form' : 'detail'

  function handleTabChange(tabId) {
    if (tabId === 'list') {
      navigate('/sales')
      return
    }

    if (tabId === 'form') {
      navigate('/sales/new', {
        state: { resetNonce: Date.now() },
      })
      return
    }

    navigate(saleId ? `/sales/${saleId}` : '/sales')
  }

  return (
    <div className="workspace-shell workspace-shell--sales">
      <section className="workspace-header">
        <div className="workspace-header__copy">
          <h2 className="workspace-header__title">
            {viewMode === 'create'
              ? 'Nova venda'
              : viewMode === 'detail'
                ? 'Detalhe da venda'
                : 'Lista de vendas'}
          </h2>
          <p className="workspace-header__description">
            {viewMode === 'create'
              ? 'Lance uma venda e feche com rapidez.'
              : viewMode === 'detail'
                ? 'Resumo executivo da venda selecionada.'
                : 'Operacao comercial em tempo real.'}
          </p>
        </div>

        <div className="workspace-nav">
          <PageTabs tabs={salesTabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </section>

      <SalesModule
        saleId={saleId ?? null}
        viewMode={viewMode}
        formResetToken={location.state?.resetNonce ?? null}
        onOpenCreate={() => navigate('/sales/new', { state: { resetNonce: Date.now() } })}
        onOpenDetail={(nextSaleId) => navigate(`/sales/${nextSaleId}`)}
        onOpenList={() => navigate('/sales')}
      />
    </div>
  )
}

export default SalesPage
