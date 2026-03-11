import '../styles/orders.css';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

import OrdersModule from '../modules/orders/components/OrdersModule';

function OrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const isNew = location.pathname === '/orders/new';
  const isEdit = location.pathname.endsWith('/edit');
  const viewMode = isNew ? 'create' : isEdit ? 'edit' : orderId ? 'detail' : 'list';

  return (
    <div className="workspace-shell workspace-shell--orders">
      <section className="workspace-header">
        <div className="workspace-header__copy">
          <p className="workspace-header__eyebrow">Pedidos</p>
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
              ? 'Monte um pedido em uma tela dedicada, com formulario completo e leitura mais limpa.'
              : viewMode === 'edit'
                ? 'Atualize o pedido em uma tela separada, sem dividir espaco com a listagem.'
                : viewMode === 'detail'
                  ? 'Consulte o pedido selecionado em uma tela exclusiva, com acoes e dados organizados.'
                  : 'Acompanhe pedidos operacionais em uma tela dedicada, com busca clara e acesso direto ao detalhe.'}
          </p>
        </div>

        <div className="workspace-nav">
          <button
            type="button"
            className={`ui-button ${viewMode === 'list' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
            onClick={() => navigate('/orders')}
          >
            Lista de pedidos
          </button>
          <button
            type="button"
            className={`ui-button ${viewMode === 'create' ? 'ui-button--secondary' : 'ui-button--primary'}`}
            onClick={() => navigate('/orders/new')}
          >
            Novo pedido
          </button>
          <button
            type="button"
            className={`ui-button ${viewMode === 'detail' || viewMode === 'edit' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
            onClick={() => navigate(orderId ? `/orders/${orderId}` : '/orders')}
            disabled={!orderId}
          >
            Detalhe do pedido
          </button>
        </div>
      </section>

      <OrdersModule
        orderId={orderId ?? null}
        viewMode={viewMode}
        onOpenCreate={() => navigate('/orders/new')}
        onOpenDetail={(nextOrderId) => navigate(`/orders/${nextOrderId}`)}
        onOpenEdit={(nextOrderId) => navigate(`/orders/${nextOrderId}/edit`)}
        onOpenList={() => navigate('/orders')}
      />
    </div>
  );
}

export default OrdersPage;
