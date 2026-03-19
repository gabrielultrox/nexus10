import PageIntro from '../components/common/PageIntro';
import CashModule from '../modules/cash/components/CashModule';

function CashPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Financeiro"
        title="Caixa"
        description="Abertura, movimentos e fechamento do dia."
      />

      <CashModule />
    </div>
  );
}

export default CashPage;
