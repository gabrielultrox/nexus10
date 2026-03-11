import PageIntro from '../components/common/PageIntro';
import SalesModule from '../modules/sales/components/SalesModule';

function SalesPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="PDV"
        title="Vendas"
        description="Dominio definitivo de vendas com lancamento real, impacto em estoque, financeiro e leitura operacional clara."
      />

      <SalesModule />
    </div>
  );
}

export default SalesPage;
