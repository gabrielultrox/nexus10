import '../styles/finance.css';

import PageIntro from '../components/common/PageIntro';
import FinanceModule from '../modules/finance/components/FinanceModule';

function FinancePage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Finance"
        title="Resumo Financeiro"
        description="Leitura consolidada de entradas, saidas, saldo operacional e movimentacoes recentes."
      />

      <FinanceModule />
    </div>
  );
}

export default FinancePage;
