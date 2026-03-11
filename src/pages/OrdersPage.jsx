import '../styles/orders.css';

import PageIntro from '../components/common/PageIntro';
import OrdersModule from '../modules/orders/components/OrdersModule';

function OrdersPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Orders"
        title="Pedidos Operacionais"
        description="Quadro dinamico organizado por status para leitura rapida e atuacao imediata."
      />

      <OrdersModule />
    </div>
  );
}

export default OrdersPage;
