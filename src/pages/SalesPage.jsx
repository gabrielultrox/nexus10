import PageIntro from '../components/common/PageIntro';
import SalesModule from '../modules/sales/components/SalesModule';

function SalesPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="PDV"
        title="Vendas"
        description="Modulo operacional de vendas com leitura real, filtros por periodo e status, e detalhe pronto para financeiro e relatorios."
      />

      <SalesModule />
    </div>
  );
}

export default SalesPage;
