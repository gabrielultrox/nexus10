import { useEffect, useMemo, useState } from 'react';

import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { firebaseReady } from '../../../services/firebase';
import {
  deleteCourierRecord,
  MANUAL_COURIER_STORAGE_KEY,
  saveCourier,
  subscribeToCouriers,
} from '../../../services/courierService';
import { appendAuditEvent } from '../../../services/localAudit';
import { loadLocalRecords, saveLocalRecords } from '../../../services/localRecords';
import {
  courierShiftOptions,
  courierStatusOptions,
} from '../schemas/courierSchema';
import { countCouriersByStatus, filterCouriers } from '../utils/courierFilters';
import CouriersFilters from './CouriersFilters';
import CouriersGrid from './CouriersGrid';
import CouriersStats from './CouriersStats';

const initialFilters = {
  search: '',
  status: 'all',
  shift: 'all',
  fixedOnly: false,
};

const initialCourierForm = {
  name: '',
  phone: '',
  vehicle: '',
  machine: '',
  shift: 'night',
  status: 'available',
  isFixed: false,
  notes: '',
};

function CouriersModule() {
  const { session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const [filters, setFilters] = useState(initialFilters);
  const [manualCouriers, setManualCouriers] = useState(() => loadLocalRecords(MANUAL_COURIER_STORAGE_KEY, []));
  const [form, setForm] = useState(initialCourierForm);
  const [errorMessage, setErrorMessage] = useState('');

  const canSyncCouriers = Boolean(firebaseReady && currentStoreId);

  useEffect(() => subscribeToCouriers(
    currentStoreId,
    (records) => {
      setManualCouriers(records);
      setErrorMessage('');
    },
    () => {
      setErrorMessage('Nao foi possivel sincronizar os entregadores com a base compartilhada.');
    },
  ), [currentStoreId]);

  useEffect(() => {
    saveLocalRecords(MANUAL_COURIER_STORAGE_KEY, manualCouriers);
  }, [manualCouriers]);

  const couriers = useMemo(
    () => manualCouriers,
    [manualCouriers],
  );

  const filteredCouriers = useMemo(
    () => filterCouriers(couriers, filters),
    [couriers, filters],
  );

  const stats = useMemo(
    () => [
      {
        id: 'all',
        label: 'Total',
        value: couriers.length,
        meta: 'entregadores monitorados',
      },
      {
        id: 'active',
        label: 'Ativos',
        value: countCouriersByStatus(couriers, 'available') + countCouriersByStatus(couriers, 'on_route'),
        meta: 'na escala de hoje',
      },
      {
        id: 'fixed',
        label: 'Fixos',
        value: couriers.filter((courier) => courier.isFixed).length,
        meta: 'permanentes',
      },
      {
        id: 'advances',
        label: 'Vales',
        value: 0,
        meta: 'pendentes',
      },
    ],
    [couriers],
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const newCourier = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim() || 'Nao informado',
      vehicle: form.vehicle.trim() || 'Moto',
      machine: form.machine.trim() || 'Sem maquininha',
      status: form.status,
      shift: form.shift,
      isFixed: form.isFixed,
      rating: 5.0,
      deliveriesToday: 0,
      weeklyDeliveries: 0,
      notes: form.notes.trim() || 'Cadastro manual realizado pela operacao.',
      timeline: [
        {
          id: `timeline-${Date.now()}`,
          time: 'Agora',
          label: 'Cadastro manual concluido no modulo de entregadores',
        },
      ],
      createdAtClient: new Date().toISOString(),
    };

    try {
      if (canSyncCouriers) {
        await saveCourier({
          storeId: currentStoreId,
          tenantId,
          courier: newCourier,
        });
      } else {
        setManualCouriers((current) => [newCourier, ...current]);
      }

      setForm(initialCourierForm);
      setErrorMessage('');
      appendAuditEvent({
        module: 'Entregadores',
        modulePath: 'couriers',
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Cadastrou entregador',
        target: newCourier.name,
        details: canSyncCouriers
          ? 'Cadastro sincronizado com a base compartilhada'
          : 'Cadastro manual realizado no modulo de entregadores',
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel salvar o entregador.');
    }
  }

  async function handleDelete(courierId) {
    const courier = manualCouriers.find((item) => item.id === courierId);

    try {
      if (canSyncCouriers) {
        await deleteCourierRecord({
          storeId: currentStoreId,
          courierId,
        });
      } else {
        setManualCouriers((current) => current.filter((item) => item.id !== courierId));
      }

      setErrorMessage('');
      appendAuditEvent({
        module: 'Entregadores',
        modulePath: 'couriers',
        actor: session?.operatorName ?? session?.displayName ?? 'Operador local',
        action: 'Excluiu entregador',
        target: courier?.name ?? 'Entregador',
        details: 'Cadastro removido do modulo de entregadores',
      });
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel excluir o entregador.');
    }
  }

  return (
    <section className="couriers-module">
      <CouriersStats items={stats} />

      <SurfaceCard title="Cadastro rapido de entregadores">
        <div className="entity-form-shell">
          <div className="entity-form-shell__header">
            <div className="entity-form-hero">
              <span className="entity-form-hero__eyebrow">Operacao de pista</span>
              <h4 className="entity-form-hero__title">Cadastro rapido sem cara de planilha</h4>
              <p className="entity-form-hero__description">
                Adicione entregadores com mais contexto visual para a escala, o turno e a leitura operacional ficarem mais agradaveis no dia a dia.
              </p>
              <div className="entity-form-hero__chips">
                <span className="ui-badge ui-badge--success">Escala de turno</span>
                <span className="ui-badge ui-badge--warning">Maquininha vinculada</span>
                <span className="ui-badge ui-badge--special">Base compartilhada</span>
              </div>
            </div>

            <div className="entity-form-aside">
              <div className="entity-form-aside__card">
                <span className="entity-form-aside__label">Total na base</span>
                <strong>{stats[0]?.value ?? 0}</strong>
                <p className="text-body">Entregadores monitorados na operacao atual.</p>
              </div>
              <div className="entity-form-aside__card">
                <span className="entity-form-aside__label">Ativos hoje</span>
                <strong>{stats[1]?.value ?? 0}</strong>
                <p className="text-body">Nomes em rota ou disponiveis para a escala do turno.</p>
              </div>
            </div>
          </div>

          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          <form className="couriers-form-grid" onSubmit={handleSubmit}>
            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Perfil</span>
                <h4 className="entity-form-section__title">Identidade do entregador</h4>
                <p className="entity-form-section__description">Dados essenciais para localizar e reconhecer rapidamente quem esta na operacao.</p>
              </div>

              <div className="entity-stack">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-name">
                    Nome
                  </label>
                  <input
                    id="courier-name"
                    className="ui-input"
                    type="text"
                    value={form.name}
                    placeholder="Nome do entregador"
                    required
                    onChange={(event) => updateField('name', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-phone-register">
                    Telefone
                  </label>
                  <input
                    id="courier-phone-register"
                    className="ui-input"
                    type="text"
                    value={form.phone}
                    placeholder="(37) 99999-0000"
                    onChange={(event) => updateField('phone', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-vehicle">
                    Veiculo
                  </label>
                  <input
                    id="courier-vehicle"
                    className="ui-input"
                    type="text"
                    value={form.vehicle}
                    placeholder="Honda Pop 110"
                    onChange={(event) => updateField('vehicle', event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Operacao</span>
                <h4 className="entity-form-section__title">Escala e equipamento</h4>
                <p className="entity-form-section__description">Vincule turno, status e maquininha no mesmo bloco de decisao.</p>
              </div>

              <div className="entity-stack">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-machine-register">
                    Maquininha
                  </label>
                  <input
                    id="courier-machine-register"
                    className="ui-input"
                    type="text"
                    value={form.machine}
                    placeholder="Maq. 03"
                    onChange={(event) => updateField('machine', event.target.value)}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-shift-register">
                    Turno
                  </label>
                  <select
                    id="courier-shift-register"
                    className="ui-select"
                    value={form.shift}
                    onChange={(event) => updateField('shift', event.target.value)}
                  >
                    {courierShiftOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="courier-status-register">
                    Status
                  </label>
                  <select
                    id="courier-status-register"
                    className="ui-select"
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                  >
                    {courierStatusOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>

                <label className="couriers-filters__checkbox couriers-form-grid__checkbox">
                  <input
                    type="checkbox"
                    checked={form.isFixed}
                    onChange={(event) => updateField('isFixed', event.target.checked)}
                  />
                  <span>Entregador fixo</span>
                </label>
              </div>
            </div>

            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Observacoes</span>
                <h4 className="entity-form-section__title">Contexto operacional</h4>
                <p className="entity-form-section__description">Anote detalhes importantes para escala, comportamento ou preferencia do turno.</p>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="courier-notes">
                  Observacoes
                </label>
                <textarea
                  id="courier-notes"
                  className="ui-textarea"
                  rows={4}
                  value={form.notes}
                  placeholder="Detalhes rapidos do perfil operacional"
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </div>
            </div>

            <div className="couriers-form-grid__actions entity-form-grid__wide">
              <button type="submit" className="ui-button ui-button--primary">
                Cadastrar entregador
              </button>
            </div>
          </form>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Filtro operacional">
        <CouriersFilters filters={filters} onChange={setFilters} />
      </SurfaceCard>

      <CouriersGrid couriers={filteredCouriers} onDelete={handleDelete} />
    </section>
  );
}

export default CouriersModule;
