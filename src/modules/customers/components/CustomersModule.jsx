import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import { firebaseReady } from '../../../services/firebase';
import {
  createCustomer,
  deleteCustomer,
  subscribeToCustomers,
  updateCustomer,
} from '../../../services/customerService';
import { playError, playSuccess } from '../../../services/soundManager';

const initialFormState = {
  name: '',
  phone: '',
  neighborhood: '',
  addressLine: '',
  reference: '',
  notes: '',
  status: 'active',
};

function mapCustomerToForm(customer) {
  return {
    name: customer.name ?? '',
    phone: customer.phoneDisplay ?? customer.phone ?? '',
    neighborhood: customer.neighborhood ?? '',
    addressLine: customer.addressLine ?? '',
    reference: customer.reference ?? '',
    notes: customer.notes ?? '',
    status: customer.status ?? 'active',
  };
}

function CustomersModule() {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const [customers, setCustomers] = useState([]);
  const [formState, setFormState] = useState(initialFormState);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    const unsubscribe = subscribeToCustomers(
      currentStoreId,
      (nextCustomers) => {
        setCustomers(nextCustomers);
        setLoading(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [currentStoreId]);

  const visibleCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const phoneSearch = searchTerm.replace(/\D/g, '');

    return customers.filter((customer) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        customer.name,
        customer.phoneDisplay,
        customer.neighborhood,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
        || (phoneSearch.length > 0 && String(customer.phone ?? '').includes(phoneSearch));

      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const activeCustomers = customers.filter((customer) => customer.status === 'active').length;
    const withAddress = customers.filter((customer) => customer.addressLine).length;
    const neighborhoods = new Set(customers.map((customer) => customer.neighborhood).filter(Boolean)).size;

    return [
      {
        label: 'Clientes',
        value: String(customers.length).padStart(2, '0'),
        meta: 'base real da store atual',
        badgeText: 'real',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Ativos',
        value: String(activeCustomers).padStart(2, '0'),
        meta: 'prontos para uso no PDV',
        badgeText: 'online',
        badgeClass: 'ui-badge--success',
      },
      {
        label: 'Com endereco',
        value: String(withAddress).padStart(2, '0'),
        meta: 'cadastros prontos para entrega',
        badgeText: 'cadastro',
        badgeClass: 'ui-badge--special',
      },
      {
        label: 'Bairros',
        value: String(neighborhoods).padStart(2, '0'),
        meta: 'distribuicao geografica da base',
        badgeText: 'mapa',
        badgeClass: 'ui-badge--warning',
      },
    ];
  }, [customers]);

  function updateField(field, value) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormState(initialFormState);
    setEditingCustomerId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!can('customers:write')) {
      setErrorMessage('Seu perfil nao pode alterar clientes.');
      playError();
      return;
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma store ativa disponivel para salvar clientes.');
      playError();
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      if (editingCustomerId) {
        await updateCustomer({
          storeId: currentStoreId,
          customerId: editingCustomerId,
          values: formState,
        });
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'customer.updated',
          entityType: 'customer',
          entityId: editingCustomerId,
          description: `Cliente ${formState.name} atualizado na base.`,
        });
        setFeedbackMessage('Cliente atualizado com sucesso.');
      } else {
        const customerId = await createCustomer({
          storeId: currentStoreId,
          tenantId,
          values: formState,
        });
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'customer.created',
          entityType: 'customer',
          entityId: customerId,
          description: `Cliente ${formState.name} criado na base.`,
        });
        setFeedbackMessage('Cliente cadastrado com sucesso.');
      }

      playSuccess();
      resetForm();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(customer) {
    setEditingCustomerId(customer.id);
    setFormState(mapCustomerToForm(customer));
    setFeedbackMessage('');
    setErrorMessage('');
  }

  async function handleDelete(customerId) {
    const customer = customers.find((item) => item.id === customerId);

    if (!currentStoreId || !window.confirm('Deseja excluir este cliente?')) {
      return;
    }

    if (!can('customers:write')) {
      setErrorMessage('Seu perfil nao pode alterar clientes.');
      playError();
      return;
    }

    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await deleteCustomer({
        storeId: currentStoreId,
        customerId,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'customer.deleted',
        entityType: 'customer',
        entityId: customerId,
        description: `Cliente ${customer?.name ?? customerId} removido da base.`,
      });

      if (editingCustomerId === customerId) {
        resetForm();
      }

      setFeedbackMessage('Cliente excluido com sucesso.');
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Clientes">
        <div className="entity-empty-state">
          <p className="text-section-title">Firebase nao configurado</p>
          <p className="text-body">Configure as variaveis VITE_FIREBASE_* para usar persistencia real.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Clientes">
        <div className="entity-empty-state">
          <p className="text-section-title">Nenhuma store ativa</p>
          <p className="text-body">Selecione ou vincule uma store antes de operar a base de clientes.</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module">
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            meta={metric.meta}
            badgeText={metric.badgeText}
            badgeClass={metric.badgeClass}
          />
        ))}
      </div>

      <SurfaceCard title={editingCustomerId ? 'Editar cliente' : 'Cadastrar cliente'}>
        <div className="entity-form-shell">
          <div className="entity-form-shell__header">
            <div className="entity-form-hero">
              <span className="entity-form-hero__eyebrow">CRM local</span>
              <h4 className="entity-form-hero__title">
                {editingCustomerId ? 'Ajuste o cadastro do cliente' : 'Cadastros mais simples para atendimento e entrega'}
              </h4>
              <p className="entity-form-hero__description">
                Centralize contato, endereco e observacoes em um fluxo mais amigavel para quem cadastra no balcao ou durante o pedido.
              </p>
              <div className="entity-form-hero__chips">
                <span className="ui-badge ui-badge--info">Telefone rapido</span>
                <span className="ui-badge ui-badge--success">Entrega preparada</span>
                <span className="ui-badge ui-badge--special">Historico por loja</span>
              </div>
            </div>

            <div className="entity-form-aside">
              <div className="entity-form-aside__card">
                <span className="entity-form-aside__label">Clientes ativos</span>
                <strong>{String(metrics[1]?.value ?? '00')}</strong>
                <p className="text-body">Base pronta para reaproveitar nos proximos pedidos do dia.</p>
              </div>
              <div className="entity-form-aside__card">
                <span className="entity-form-aside__label">Com endereco</span>
                <strong>{String(metrics[2]?.value ?? '00')}</strong>
                <p className="text-body">Cadastros com entrega mais agil e menos retrabalho.</p>
              </div>
            </div>
          </div>

          <form className="entity-form-grid" onSubmit={handleSubmit}>
            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Contato</span>
                <h4 className="entity-form-section__title">Identificacao rapida</h4>
                <p className="entity-form-section__description">Nome e telefone para encontrar o cliente sem hesitacao.</p>
              </div>

              <div className="entity-stack">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="customer-name">Nome</label>
                  <input id="customer-name" className="ui-input" value={formState.name} onChange={(event) => updateField('name', event.target.value)} />
                  <span className="entity-field-hint">Prefira o nome como o cliente costuma se apresentar no pedido.</span>
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="customer-phone">Telefone</label>
                  <input id="customer-phone" className="ui-input" value={formState.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="(37) 99999-0000" />
                  <span className="entity-field-hint">Use o numero principal para confirmar pedido e acionar entregador.</span>
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="customer-status">Status</label>
                  <select id="customer-status" className="ui-select" value={formState.status} onChange={(event) => updateField('status', event.target.value)}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Entrega</span>
                <h4 className="entity-form-section__title">Endereco e referencia</h4>
                <p className="entity-form-section__description">Bloco pensado para reduzir erro de rota e perguntas repetidas.</p>
              </div>

              <div className="entity-stack">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="customer-neighborhood">Bairro</label>
                  <input id="customer-neighborhood" className="ui-input" value={formState.neighborhood} onChange={(event) => updateField('neighborhood', event.target.value)} />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="customer-address">Endereco</label>
                  <input id="customer-address" className="ui-input" value={formState.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="customer-reference">Referencia</label>
                  <input id="customer-reference" className="ui-input" value={formState.reference} onChange={(event) => updateField('reference', event.target.value)} />
                  <span className="entity-field-hint">Exemplo: portao preto, esquina da farmacia, casa 2.</span>
                </div>
              </div>
            </div>

            <div className="entity-form-section entity-form-section--span-2">
              <div className="entity-form-section__header">
                <span className="entity-form-section__eyebrow">Observacoes</span>
                <h4 className="entity-form-section__title">Contexto de atendimento</h4>
                <p className="entity-form-section__description">Notas que ajudam o time em recorrencia, preferencia ou cuidado especial.</p>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="customer-notes">Observacoes</label>
                <textarea id="customer-notes" className="ui-textarea" rows={4} value={formState.notes} onChange={(event) => updateField('notes', event.target.value)} />
              </div>
            </div>

            <div className="entity-form-actions entity-form-grid__wide">
              {editingCustomerId ? (
                <button type="button" className="ui-button ui-button--ghost" onClick={resetForm}>
                  Cancelar edicao
                </button>
              ) : null}
              <button type="submit" className="ui-button ui-button--primary" disabled={saving || !can('customers:write')}>
                {saving ? 'Salvando...' : editingCustomerId ? 'Salvar cliente' : 'Cadastrar cliente'}
              </button>
            </div>
          </form>
        </div>

        {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
      </SurfaceCard>

      <SurfaceCard title="Base de clientes">
        <div className="entity-toolbar-shell">
          <div className="entity-toolbar-copy">
            <p className="text-section-title">Busca mais clara</p>
            <p className="text-body">Filtre por contato ou status para encontrar o cadastro certo sem varrer a tabela toda.</p>
          </div>

          <div className="entity-toolbar">
            <div className="ui-field">
              <label className="ui-label" htmlFor="customers-search">Buscar</label>
              <input id="customers-search" className="ui-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nome ou telefone" />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="customers-status-filter">Status</label>
              <select id="customers-status-filter" className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="entity-empty-state">
            <p className="text-section-title">Carregando clientes...</p>
          </div>
        ) : visibleCustomers.length === 0 ? (
          <div className="entity-empty-state">
            <p className="text-section-title">Nenhum cliente encontrado</p>
            <p className="text-body">Cadastre clientes ou ajuste a busca para continuar.</p>
          </div>
        ) : (
          <div className="entity-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Bairro</th>
                  <th>Endereco</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="ui-table__cell--strong">{customer.name}</td>
                    <td>{customer.phoneDisplay ?? customer.phone}</td>
                    <td>{customer.neighborhood || '-'}</td>
                    <td>{customer.addressLine || '-'}</td>
                    <td>{customer.status === 'active' ? 'Ativo' : 'Inativo'}</td>
                    <td className="entity-table__actions">
                      <button type="button" className="ui-button ui-button--ghost" onClick={() => handleEdit(customer)} disabled={!can('customers:write')}>
                        Editar
                      </button>
                      <button type="button" className="ui-button ui-button--danger" onClick={() => handleDelete(customer.id)} disabled={!can('customers:write')}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </section>
  );
}

export default CustomersModule;
