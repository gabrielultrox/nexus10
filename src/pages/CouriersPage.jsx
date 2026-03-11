import '../styles/couriers.css';

import PageIntro from '../components/common/PageIntro';
import CouriersModule from '../modules/couriers/components/CouriersModule';

function CouriersPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Entregadores"
        title="Entregadores"
        description="Operacao central do time de pista, com leitura rapida de status, turno e disponibilidade."
      />

      <CouriersModule />
    </div>
  );
}

export default CouriersPage;
