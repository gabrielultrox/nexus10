import { Link, useParams } from 'react-router-dom';

import '../styles/couriers.css';

import CourierProfilePanel from '../modules/couriers/components/CourierProfilePanel';
import { findCourierById } from '../modules/couriers/utils/courierFilters';
import { loadLocalRecords } from '../services/localRecords';

const manualCourierStorageKey = 'nexus-manual-couriers';

function CourierProfilePage() {
  const { courierId } = useParams();
  const manualCouriers = loadLocalRecords(manualCourierStorageKey, []);
  const courier = findCourierById(manualCouriers, courierId);

  if (!courier) {
    return (
      <div className="page-stack">
        <div className="surface-card courier-empty-state">
          <div className="surface-card__content">
            <p className="text-overline">Entregador</p>
            <h2 className="text-section-title">Entregador nao encontrado</h2>
            <p className="text-body">O perfil solicitado nao existe na base manual atual.</p>
            <Link to="/couriers" className="ui-button ui-button--ghost courier-back-link">
              Voltar para entregadores
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="courier-profile-page__header">
        <div>
          <p className="text-overline">Perfil do entregador</p>
          <h1 className="text-page-title">{courier.name}</h1>
          <p className="text-body">Perfil operacional com status atual, metricas e acoes principais.</p>
        </div>

        <Link to="/couriers" className="ui-button ui-button--ghost courier-back-link">
          Voltar para entregadores
        </Link>
      </div>

      <CourierProfilePanel courier={courier} />
    </div>
  );
}

export default CourierProfilePage;
