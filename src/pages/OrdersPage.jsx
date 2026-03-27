import '../styles/orders.css'

import { useLocation, useNavigate, useParams } from 'react-router-dom'

import PageTabs from '../components/common/PageTabs'
import OrdersModule from '../modules/orders/components/OrdersModule'

function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { orderId } = useParams()
  const isNew = location.pathname === '/orders/new'
  const isEdit = location.pathname.endsWith('/edit')
  const viewMode = isNew ? 'create' : isEdit ? 'edit' : orderId ? 'detail' : 'list'
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
  )
}

export default OrdersPage
