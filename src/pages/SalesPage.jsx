import { useLocation, useNavigate, useParams } from 'react-router-dom'

import PageTabs from '../components/common/PageTabs'
import { Card, ErrorDisplay, LoadingOverlay, Skeleton } from '../components/ui'
import { useDashboardSales, useStore } from '../hooks'
import SalesModule from '../modules/sales/components/SalesModule'
import { getApiErrorDisplayModel } from '../services/apiErrorHandler'

function SalesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { saleId } = useParams()
  const { currentStoreId } = useStore()
  const isNew = location.pathname === '/sales/new'
  const viewMode = isNew ? 'create' : saleId ? 'detail' : 'list'
  const salesQuery = useDashboardSales({
    storeId: currentStoreId,
    enabled: viewMode === 'list',
  })
  const salesErrorModel = salesQuery.error ? getApiErrorDisplayModel(salesQuery.error) : null
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

      {viewMode === 'list' ? (
        <Card className="workspace-loading-card">
          <Card.Body>
            <div className="workspace-loading-card__header">
              <div>
                <p className="story-title">Resumo comercial</p>
                <p className="story-copy">Snapshot rapido das vendas mais recentes.</p>
              </div>
            </div>

            {salesQuery.isLoading ? (
              <div className="workspace-loading-grid">
                <Skeleton height="18px" width="20%" />
                <Skeleton lines={3} height="14px" />
              </div>
            ) : salesQuery.error ? (
              <ErrorDisplay
                code={salesErrorModel?.code}
                title={salesErrorModel?.title}
                message={
                  salesErrorModel?.message ?? 'Nao foi possivel carregar o resumo das vendas.'
                }
                suggestion={salesErrorModel?.suggestion}
                actionLabel="Tentar novamente"
                onAction={() => salesQuery.refetch()}
              />
            ) : (
              <div className="workspace-loading-grid">
                <strong className="workspace-loading-card__value">
                  {salesQuery.summary.count} venda(s) na pagina inicial
                </strong>
                <div className="workspace-loading-card__list">
                  {salesQuery.summary.items.slice(0, 3).map((item) => (
                    <span key={item.id} className="workspace-loading-card__item">
                      {item.channelLabel ?? 'Canal nao informado'} - {item.status ?? 'Sem status'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      ) : null}

      <div className="workspace-loading-shell">
        <LoadingOverlay
          active={viewMode === 'list' && salesQuery.isLoading}
          label="Carregando fila inicial de vendas"
        />
        <SalesModule
          saleId={saleId ?? null}
          viewMode={viewMode}
          formResetToken={location.state?.resetNonce ?? null}
          onOpenCreate={() => navigate('/sales/new', { state: { resetNonce: Date.now() } })}
          onOpenDetail={(nextSaleId) => navigate(`/sales/${nextSaleId}`)}
          onOpenList={() => navigate('/sales')}
        />
      </div>
    </div>
  )
}

export default SalesPage
