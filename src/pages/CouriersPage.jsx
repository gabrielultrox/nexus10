import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import '../styles/couriers.css';

import PageIntro from '../components/common/PageIntro';
import PageTabs from '../components/common/PageTabs';
import CouriersModule from '../modules/couriers/components/CouriersModule';

const COURIERS_TABS = [
  { id: 'consulta', label: 'Consulta' },
  { id: 'cadastro', label: 'Cadastro' },
];

function CouriersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRegisterMode = location.pathname.endsWith('/cadastro');
  const editingCourierId = searchParams.get('edit');
  const activeTab = isRegisterMode ? 'cadastro' : 'consulta';

  function clearEditingCourier() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('edit');
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Entregadores"
        title={
          isRegisterMode
            ? editingCourierId
              ? 'Editar entregador'
              : 'Cadastro de entregadores'
            : 'Consulta de entregadores'
        }
        description={
          isRegisterMode
            ? editingCourierId
              ? 'Ajuste os dados do entregador e atualize a maquininha fixa sem misturar com a tela de consulta.'
              : 'Cadastre nome, status, turno e maquininha fixa em uma tela dedicada, sem disputar espaco com a consulta.'
            : 'Consulte a base de entregadores com filtros, leitura rapida de status e acesso direto ao perfil.'
        }
      />

      <section className="couriers-page-nav-shell">
        <div className="couriers-page-nav-shell__header">
          <span className="text-overline">Fluxo de trabalho</span>
          <h2 className="text-section-title">Escolha a area de operacao</h2>
        </div>

        <PageTabs
          tabs={COURIERS_TABS}
          activeTab={activeTab}
          onTabChange={(id) => navigate(`/couriers/${id}`)}
        />
      </section>

      <CouriersModule
        mode={isRegisterMode ? 'register' : 'lookup'}
        editingCourierId={isRegisterMode ? editingCourierId : null}
        onFinishEditing={clearEditingCourier}
      />
    </div>
  );
}

export default CouriersPage;
