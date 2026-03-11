import { NavLink, useLocation } from 'react-router-dom';

import '../styles/couriers.css';

import PageIntro from '../components/common/PageIntro';
import CouriersModule from '../modules/couriers/components/CouriersModule';

function CouriersPage() {
  const location = useLocation();
  const isRegisterMode = location.pathname.endsWith('/cadastro');

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Entregadores"
        title={isRegisterMode ? 'Cadastro de entregadores' : 'Consulta de entregadores'}
        description={
          isRegisterMode
            ? 'Cadastre nome, status, turno e maquininha em uma tela dedicada, sem disputar espaco com a consulta.'
            : 'Consulte a base de entregadores com filtros, leitura rapida de status e acesso direto ao perfil.'
        }
      />

      <div className="couriers-page-nav">
        <NavLink
          to="/couriers/consulta"
          className={({ isActive }) => `ui-button ${isActive ? 'ui-button--secondary' : 'ui-button--ghost'}`}
        >
          Consulta de entregadores
        </NavLink>
        <NavLink
          to="/couriers/cadastro"
          className={({ isActive }) => `ui-button ${isActive ? 'ui-button--primary' : 'ui-button--ghost'}`}
        >
          Cadastro de entregadores
        </NavLink>
      </div>

      <CouriersModule mode={isRegisterMode ? 'register' : 'lookup'} />
    </div>
  );
}

export default CouriersPage;
