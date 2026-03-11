import PageIntro from '../components/common/PageIntro';
import PosReportsModule from '../modules/reports/components/PosReportsModule';

function PosReportsPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="PDV"
        title="Relatorios do PDV"
        description="Leitura real da operacao comercial com vendas, pedidos, financeiro e estrutura pronta para exportacao CSV."
      />

      <PosReportsModule />
    </div>
  );
}

export default PosReportsPage;
