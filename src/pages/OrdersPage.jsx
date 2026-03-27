import '../styles/orders.css'

import { useLocation, useNavigate, useParams } from 'react-router-dom'

import PageTabs from '../components/common/PageTabs'
import { Card, LoadingOverlay, Skeleton } from '../components/ui'
import { useDashboardOrders, useStore } from '../hooks'
import OrdersModule from '../modules/orders/components/OrdersModule'

function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { currentStoreId } = useStore()
  const isNew = location.pathname === '/orders/new'
  const isEdit = location.pathname.endsWith('/edit')
  const viewMode = isNew ? 'create' : isEdit ? 'edit' : orderId ? 'detail' : 'list'
  const ordersQuery = useDashboardOrders({
    storeId: currentStoreId,
    enabled: viewMode === 'list',
  })
  const orderTabs = [
    { id: 'list', label: 'Lista de pedidos' },
    { id: 'form', label: viewMode === 'edit' ? 'Editar pedido' : 'Novo pedido' },
    ...(orderId ? [{ id: 'detail', label: 'Detalhe do pedido' }] : []),
  ]
  const activeTab =
    viewMode === 'list' ? 'list' : viewMode === 'create' || viewMode === 'edit' ? 'form' : 'detail'

  function handleTabChange(tabId) {
    if (tabId === 'list') {
      navigate('/orders')
      return
    }

    if (tabId === 'form') {
      navigate('/orders/new', {
        state: { resetNonce: Date.now() },
      })
      return
    }

    navigate(orderId ? `/orders/${orderId}` : '/orders')
  }

  return (
    <div className="workspace-shell workspace-shell--orders">
      <section className="workspace-header">
        <div className="workspace-header__copy">
          <h2 className="workspace-header__title">
            {viewMode === 'create'
              ? 'Novo pedido'
              : viewMode === 'edit'
                ? 'Editar pedido'
                : viewMode === 'detail'
                  ? 'Detalhe do pedido'
                  : 'Lista de pedidos'}
          </h2>
          <p className="workspace-header__description">
            {viewMode === 'create'
              ? 'Monte os itens e conclua o lancamento.'
              : viewMode === 'edit'
                ? 'Revise itens, totais e status.'
                : viewMode === 'detail'
                  ? 'Resumo executivo do pedido selecionado.'
                  : 'Fila operacional de pedidos.'}
          </p>
        </div>

        <div className="workspace-nav">
          <PageTabs tabs={orderTabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </section>

      {viewMode === 'list' ? (
        <Card className="workspace-loading-card">
          <Card.Body>
            <div className="workspace-loading-card__header">
              <div>
                <p className="story-title">Resumo da fila</p>
                <p className="story-copy">Leitura rapida antes de abrir a operacao completa.</p>
              </div>
            </div>

            {ordersQuery.isLoading ? (
              <div className="workspace-loading-grid">
                <Skeleton height="18px" width="18%" />
                <Skeleton lines={3} height="14px" />
              </div>
            ) : ordersQuery.error ? (
              <div className="auth-error" role="alert">
                Nao foi possivel carregar o resumo dos pedidos.
              </div>
            ) : (
              <div className="workspace-loading-grid">
                <strong className="workspace-loading-card__value">
                  {ordersQuery.summary.count} pedido(s) na pagina inicial
                </strong>
                <div className="workspace-loading-card__list">
                  {ordersQuery.summary.items.slice(0, 3).map((item) => (
                    <span key={item.id} className="workspace-loading-card__item">
                      {item.customerName ?? 'Cliente sem nome'} · {item.status ?? 'Sem status'}
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
          active={viewMode === 'list' && ordersQuery.isLoading}
          label="Carregando fila inicial de pedidos"
        />
        <OrdersModule
          orderId={orderId ?? null}
          viewMode={viewMode}
          formResetToken={location.state?.resetNonce ?? null}
          onOpenCreate={() => navigate('/orders/new', { state: { resetNonce: Date.now() } })}
          onOpenDetail={(nextOrderId) => navigate(`/orders/${nextOrderId}`)}
          onOpenEdit={(nextOrderId) => navigate(`/orders/${nextOrderId}/edit`)}
          onOpenList={() => navigate('/orders')}
        />
      </div>
    </div>
  )
}

export default OrdersPage
