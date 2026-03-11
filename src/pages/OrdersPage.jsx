import '../styles/orders.css';

import PageIntro from '../components/common/PageIntro';
import OrdersModule from '../modules/orders/components/OrdersModule';

function OrdersPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="PDV"
        title="Pedidos"
        description="Dominio comercial e operacional para registrar, despachar e converter pedidos em venda sem afetar estoque ou financeiro."
      />

      <OrdersModule />
    </div>
  );
}

export default OrdersPage;
