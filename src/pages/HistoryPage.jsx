import PageIntro from '../components/common/PageIntro';
import HistoryTimelineModule from '../modules/history/components/HistoryTimelineModule';

function HistoryPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Historico"
        title="Historico operacional"
        description="Calendario por dia e leitura separada por categoria da operacao."
      />

      <HistoryTimelineModule />
    </div>
  );
}

export default HistoryPage;
