import PageIntro from '../components/common/PageIntro';
import CashModule from '../modules/cash/components/CashModule';

function CashPage() {
  return (
    <div className="page-stack">
      <PageIntro
        title="Caixa"
        description="Abertura, sangria, suprimento e fechamento com historico e recibo do dia."
      />

      <CashModule />
    </div>
  );
}

export default CashPage;
