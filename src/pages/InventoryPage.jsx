import PageIntro from '../components/common/PageIntro';
import InventoryModule from '../modules/inventory/components/InventoryModule';

function InventoryPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Estoque"
        title="Controle de estoque"
        description="Saldo atual, ajustes manuais, baixas automaticas por venda e historico de movimentacao com importacao CSV."
      />

      <InventoryModule />
    </div>
  );
}

export default InventoryPage;
