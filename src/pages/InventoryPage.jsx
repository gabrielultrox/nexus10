import PageIntro from '../components/common/PageIntro';
import InventoryModule from '../modules/inventory/components/InventoryModule';

function InventoryPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Estoque"
        title="Controle de estoque"
        description="Consulte saldo, registre ajustes manuais e acompanhe o historico do estoque em uma tela mais direta."
      />

      <InventoryModule />
    </div>
  );
}

export default InventoryPage;
