import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import { formatCurrencyBRL, getOrderDomainStatusLabel } from '../../../services/commerce';
import { subscribeToCustomers } from '../../../services/customerService';
import { firebaseReady } from '../../../services/firebase';
import {
  convertOrderToSale,
  createOrder,
  getOrderById,
  markOrderAsDispatched,
  subscribeToOrders,
  updateOrder,
} from '../../../services/orders';
import { subscribeToProducts } from '../../../services/productService';
import { playError, playSuccess } from '../../../services/soundManager';
import OrderDetailPanel from './OrderDetailPanel';
import OrderFormPanel from './OrderFormPanel';

const statusOptions = ['OPEN', 'DISPATCHED', 'CONVERTED_TO_SALE', 'CANCELLED'];
const sourceOptions = ['BALCAO', 'ZE_DELIVERY', 'ANOTA_AI', 'IFOOD'];
const paymentOptions = ['DINHEIRO', 'ONLINE', 'CREDITO', 'DEBITO', 'PIX'];

function createEmptyItem() {
  return {
    productId: '',
    quantity: '1',
    unitPrice: '',
  };
}

function createInitialFormState() {
  return {
    source: 'BALCAO',
    customerId: '',
    paymentMethod: 'PIX',
    notes: '',
    address: {
      neighborhood: '',
      addressLine: '',
      reference: '',
      complement: '',
    },
    totals: {
      freight: '0',
      extraAmount: '0',
      discountPercent: '0',
      discountValue: '0',
    },
    items: [createEmptyItem()],
  };
}

function asDate(value) {
  if (!value) {
    return null;
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
}

function formatDateTime(value) {
  const dateValue = asDate(value);

  if (!dateValue || Number.isNaN(dateValue.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue);
}

function parseDecimal(value) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function mapOrderToForm(order) {
  return {
    source: order.sourceChannel ?? 'BALCAO',
    customerId: order.customerId ?? order.customerSnapshot?.id ?? '',
    paymentMethod: order.paymentPreview?.method ?? order.paymentMethod ?? 'PIX',
    notes: order.notes ?? '',
    address: {
      neighborhood: order.address?.neighborhood ?? '',
      addressLine: order.address?.addressLine ?? '',
      reference: order.address?.reference ?? '',
      complement: order.address?.complement ?? '',
    },
    totals: {
      freight: String(order.totals?.freight ?? 0),
      extraAmount: String(order.totals?.extraAmount ?? 0),
      discountPercent: String(order.totals?.discountPercent ?? 0),
      discountValue: String(order.totals?.discountValue ?? 0),
    },
    items: Array.isArray(order.items) && order.items.length > 0
      ? order.items.map((item) => ({
        productId: item.productId ?? item.productSnapshot?.id ?? '',
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
      : [createEmptyItem()],
  };
}

function OrdersModule() {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [formState, setFormState] = useState(() => createInitialFormState());
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [activeScreen, setActiveScreen] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    const unsubscribe = subscribeToOrders(
      currentStoreId,
      (nextOrders) => {
        setOrders(nextOrders);
        setLoading(false);
      },
      (error) => {
        setErrorMessage(error.message ?? 'Nao foi possivel carregar os pedidos.');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [currentStoreId]);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      return undefined;
    }

    const unsubscribeCustomers = subscribeToCustomers(currentStoreId, setCustomers, () => {});
    const unsubscribeProducts = subscribeToProducts(currentStoreId, setProducts, () => {});

    return () => {
      unsubscribeCustomers?.();
      unsubscribeProducts?.();
    };
  }, [currentStoreId]);

  const internalOrders = useMemo(() => orders.filter((order) => !order.isExternal), [orders]);

  useEffect(() => {
    if (!selectedOrderId && internalOrders.length > 0) {
      setSelectedOrderId(internalOrders[0].id);
    }

    if (selectedOrderId && !internalOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(internalOrders[0]?.id ?? null);
    }
  }, [internalOrders, selectedOrderId]);

  const visibleOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return internalOrders.filter((order) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        order.number,
        order.code,
        order.customerName,
        order.customerSnapshot?.phone,
        order.source,
        order.notes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || order.domainStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [internalOrders, searchTerm, statusFilter]);

  const selectedOrder = useMemo(
    () => internalOrders.find((order) => order.id === selectedOrderId) ?? null,
    [internalOrders, selectedOrderId],
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === formState.customerId) ?? null,
    [customers, formState.customerId],
  );

  const draftItems = useMemo(
    () => formState.items.map((item, index) => {
      const product = products.find((entry) => entry.id === item.productId) ?? null;
      const quantity = parseDecimal(item.quantity);
      const fallbackUnitPrice = product ? Number(product.price ?? 0) : 0;
      const unitPrice = item.unitPrice === '' ? fallbackUnitPrice : parseDecimal(item.unitPrice);

      return {
        key: `${item.productId || 'item'}-${index}`,
        product,
        productId: item.productId,
        quantity,
        unitPrice,
        totalPrice: Number((quantity * unitPrice).toFixed(2)),
      };
    }),
    [formState.items, products],
  );

  const calculatedTotals = useMemo(() => {
    const subtotal = Number(
      draftItems.reduce((total, item) => total + Number(item.totalPrice ?? 0), 0).toFixed(2),
    );
    const freight = parseDecimal(formState.totals.freight);
    const extraAmount = parseDecimal(formState.totals.extraAmount);
    const discountPercent = parseDecimal(formState.totals.discountPercent);
    const explicitDiscountValue = parseDecimal(formState.totals.discountValue);
    const discountValue = explicitDiscountValue > 0
      ? explicitDiscountValue
      : Number((subtotal * (discountPercent / 100)).toFixed(2));
    const total = Number((subtotal + freight + extraAmount - discountValue).toFixed(2));

    return {
      subtotal,
      freight,
      extraAmount,
      discountPercent,
      discountValue,
      total: Math.max(0, total),
    };
  }, [draftItems, formState.totals]);

  const metrics = useMemo(() => {
    const open = internalOrders.filter((order) => order.domainStatus === 'OPEN').length;
    const dispatched = internalOrders.filter((order) => order.domainStatus === 'DISPATCHED').length;
    const converted = internalOrders.filter((order) => order.domainStatus === 'CONVERTED_TO_SALE').length;

    return [
      {
        label: 'Pedidos',
        value: String(internalOrders.length).padStart(2, '0'),
        meta: 'registros comerciais e operacionais da loja',
        badgeText: 'dominio',
        badgeClass: 'ui-badge--info',
      },
      {
        label: 'Abertos',
        value: String(open).padStart(2, '0'),
        meta: 'prontos para expedicao ou ajuste',
        badgeText: 'fila',
        badgeClass: 'ui-badge--warning',
      },
      {
        label: 'Despachados',
        value: String(dispatched).padStart(2, '0'),
        meta: 'pedidos com operacao concluida',
        badgeText: 'envio',
        badgeClass: 'ui-badge--special',
      },
      {
        label: 'Viraram venda',
        value: String(converted).padStart(2, '0'),
        meta: 'conversoes sem impacto em estoque ou financeiro',
        badgeText: 'venda',
        badgeClass: 'ui-badge--success',
      },
    ];
  }, [internalOrders]);

  function resetForm() {
    setFormState(createInitialFormState());
    setEditingOrderId(null);
  }

  function handleStartCreate() {
    resetForm();
    setErrorMessage('');
    setFeedbackMessage('');
    setActiveScreen('create');
  }

  function handleCancelForm() {
    resetForm();
    setErrorMessage('');
    setFeedbackMessage('');
    setActiveScreen(selectedOrderId ? 'detail' : 'list');
  }

  function handleSelectOrder(orderId) {
    setSelectedOrderId(orderId);
    setActiveScreen('detail');
    setErrorMessage('');
    setFeedbackMessage('');
  }

  function handleStartEdit(order) {
    setEditingOrderId(order.id);
    setSelectedOrderId(order.id);
    setFormState(mapOrderToForm(order));
    setErrorMessage('');
    setFeedbackMessage('');
    setActiveScreen('create');
  }

  function updateAddressField(field, value) {
    setFormState((current) => ({
      ...current,
      address: {
        ...current.address,
        [field]: value,
      },
    }));
  }

  function updateTotalsField(field, value) {
    setFormState((current) => ({
      ...current,
      totals: {
        ...current.totals,
        [field]: value,
      },
    }));
  }

  function updateItem(index, field, value) {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === 'productId') {
          const product = products.find((entry) => entry.id === value);

          return {
            ...item,
            productId: value,
            unitPrice: product ? String(product.price ?? 0) : '',
          };
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    }));
  }

  function addItem() {
    setFormState((current) => ({
      ...current,
      items: [...current.items, createEmptyItem()],
    }));
  }

  function removeItem(index) {
    setFormState((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function handleCustomerChange(customerId) {
    const customer = customers.find((entry) => entry.id === customerId) ?? null;

    setFormState((current) => ({
      ...current,
      customerId,
      address: {
        ...current.address,
        neighborhood: current.address.neighborhood || customer?.neighborhood || '',
        addressLine: current.address.addressLine || customer?.addressLine || '',
        reference: current.address.reference || customer?.reference || '',
      },
    }));
  }

  function buildPayload() {
    if (draftItems.some((item) => !item.productId || !item.product)) {
      throw new Error('Selecione um produto valido para todos os itens.');
    }

    return {
      source: formState.source,
      customerId: selectedCustomer?.id ?? null,
      customerSnapshot: selectedCustomer
        ? {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          phone: selectedCustomer.phoneDisplay ?? selectedCustomer.phone ?? '',
          neighborhood: selectedCustomer.neighborhood ?? '',
        }
        : undefined,
      items: draftItems.map((item) => ({
        productId: item.productId,
        productSnapshot: {
          id: item.product?.id ?? item.productId,
          name: item.product?.name ?? 'Produto',
          category: item.product?.category ?? '',
          sku: item.product?.sku ?? '',
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      totals: calculatedTotals,
      paymentMethod: formState.paymentMethod,
      paymentPreview: {
        method: formState.paymentMethod,
        label: getPaymentMethodLabel(formState.paymentMethod),
        amount: calculatedTotals.total,
      },
      address: {
        neighborhood: formState.address.neighborhood || selectedCustomer?.neighborhood || '',
        addressLine: formState.address.addressLine || selectedCustomer?.addressLine || '',
        reference: formState.address.reference || selectedCustomer?.reference || '',
        complement: formState.address.complement,
      },
      notes: formState.notes,
    };
  }

  async function refreshSelectedOrder(orderId) {
    if (!currentStoreId || !orderId) {
      return null;
    }

    const order = await getOrderById({
      storeId: currentStoreId,
      orderId,
    });

    if (order) {
      setSelectedOrderId(order.id);
    }

    return order;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!can('orders:write')) {
      setErrorMessage('Seu perfil nao pode alterar pedidos.');
      playError();
      return;
    }

    if (!currentStoreId) {
      setErrorMessage('Nenhuma loja ativa disponivel para salvar pedidos.');
      playError();
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      const values = buildPayload();

      if (editingOrderId) {
        await updateOrder({
          storeId: currentStoreId,
          orderId: editingOrderId,
          values,
        });
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'order.updated',
          entityType: 'order',
          entityId: editingOrderId,
          description: `Pedido ${selectedOrder?.number ?? editingOrderId} atualizado.`,
        });
        await refreshSelectedOrder(editingOrderId);
        setFeedbackMessage('Pedido atualizado com sucesso.');
      } else {
        const orderId = await createOrder({
          storeId: currentStoreId,
          tenantId,
          values,
          createdBy: session,
        });
        await recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: 'order.created',
          entityType: 'order',
          entityId: orderId,
          description: `Novo pedido ${values.source} criado com total ${formatCurrencyBRL(calculatedTotals.total)}.`,
        });
        await refreshSelectedOrder(orderId);
        setFeedbackMessage('Pedido cadastrado com sucesso.');
      }

      playSuccess();
      resetForm();
      setActiveScreen('detail');
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel salvar o pedido.');
      playError();
    } finally {
      setSaving(false);
    }
  }

  async function handleDispatch() {
    if (!selectedOrder || !currentStoreId) {
      return;
    }

    if (!can('orders:write')) {
      setErrorMessage('Seu perfil nao pode alterar pedidos.');
      playError();
      return;
    }

    setActing(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await markOrderAsDispatched({
        storeId: currentStoreId,
        orderId: selectedOrder.id,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'order.dispatched',
        entityType: 'order',
        entityId: selectedOrder.id,
        description: `Pedido ${selectedOrder.number} marcado como despachado.`,
      });
      await refreshSelectedOrder(selectedOrder.id);
      setFeedbackMessage('Pedido marcado como despachado.');
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel despachar o pedido.');
      playError();
    } finally {
      setActing(false);
    }
  }

  async function handleConvertToSale() {
    if (!selectedOrder || !currentStoreId) {
      return;
    }

    if (!can('orders:write')) {
      setErrorMessage('Seu perfil nao pode alterar pedidos.');
      playError();
      return;
    }

    setActing(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      const saleId = await convertOrderToSale({
        storeId: currentStoreId,
        tenantId,
        orderId: selectedOrder.id,
        createdBy: session,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'order.converted_to_sale',
        entityType: 'order',
        entityId: selectedOrder.id,
        description: `Pedido ${selectedOrder.number} gerou a venda ${saleId}.`,
      });
      await refreshSelectedOrder(selectedOrder.id);
      setFeedbackMessage(`Venda ${saleId} gerada com sucesso.`);
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel gerar a venda.');
      playError();
    } finally {
      setActing(false);
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Pedidos">
        <div className="entity-empty-state">
          <p className="text-section-title">Firebase nao configurado</p>
          <p className="text-body">Configure as variaveis VITE_FIREBASE_* para usar persistencia real.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Pedidos">
        <div className="entity-empty-state">
          <p className="text-section-title">Nenhuma loja ativa</p>
          <p className="text-body">Selecione uma loja antes de operar o dominio de pedidos.</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module orders-domain">
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

      <SurfaceCard title="Area de trabalho de pedidos">
        <div className="orders-domain__header">
          <div className="orders-domain__copy">
            <p className="text-section-title">Lista de Pedidos</p>
            <p className="text-body">
              Controle pedidos comerciais sem disparar impacto em estoque ou financeiro.
            </p>
          </div>

          <div className="orders-domain__actions">
            <button
              type="button"
              className={`ui-button ${activeScreen === 'list' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
              onClick={() => setActiveScreen('list')}
            >
              Lista de Pedidos
            </button>
            <button
              type="button"
              className={`ui-button ${activeScreen === 'create' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
              onClick={handleStartCreate}
              disabled={!can('orders:write')}
            >
              Novo pedido
            </button>
            <button
              type="button"
              className={`ui-button ${activeScreen === 'detail' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
              onClick={() => setActiveScreen('detail')}
              disabled={!selectedOrder}
            >
              Detalhe do Pedido
            </button>
          </div>
        </div>

        {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

        <div className="orders-domain__layout">
          <div className="orders-domain__column">
            <div className="entity-toolbar-shell">
              <div className="entity-toolbar-copy">
                <p className="text-section-title">Busca e acompanhamento</p>
                <p className="text-body">Filtre por cliente, codigo ou status para chegar no pedido certo mais rapido.</p>
              </div>

              <div className="entity-toolbar">
                <div className="ui-field">
                  <label className="ui-label" htmlFor="orders-search">Buscar</label>
                  <input
                    id="orders-search"
                    className="ui-input"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Codigo, cliente ou observacao"
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label" htmlFor="orders-status-filter">Status</label>
                  <select
                    id="orders-status-filter"
                    className="ui-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">Todos</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{getOrderDomainStatusLabel(status)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="orders-domain__list-shell">
              <div className="entity-table-wrap">
                {loading ? (
                  <div className="entity-empty-state">
                    <p className="text-section-title">Carregando pedidos...</p>
                  </div>
                ) : visibleOrders.length === 0 ? (
                  <div className="entity-empty-state">
                    <p className="text-section-title">Nenhum pedido encontrado</p>
                    <p className="text-body">Crie um novo pedido ou ajuste os filtros para continuar.</p>
                  </div>
                ) : (
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Canal</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Venda</th>
                        <th>Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={order.id === selectedOrderId ? 'entity-table__row--selected' : undefined}
                          onClick={() => handleSelectOrder(order.id)}
                        >
                          <td className="ui-table__cell--strong">{order.number}</td>
                          <td>{order.origin}</td>
                          <td>{order.customerName}</td>
                          <td className="ui-table__cell--numeric">{order.total}</td>
                          <td>{getOrderDomainStatusLabel(order.domainStatus)}</td>
                          <td>{order.saleStatus === 'LAUNCHED' ? 'Lancada' : 'Nao lancada'}</td>
                          <td>{formatDateTime(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="orders-domain__column">
            {activeScreen === 'create' ? (
              <OrderFormPanel
                canWrite={can('orders:write')}
                editingOrderId={editingOrderId}
                customers={customers}
                products={products}
                formState={formState}
                saving={saving}
                draftItems={draftItems}
                calculatedTotals={calculatedTotals}
                sourceOptions={sourceOptions}
                paymentOptions={paymentOptions}
                onCancel={handleCancelForm}
                onSubmit={handleSubmit}
                onCustomerChange={handleCustomerChange}
                onFieldChange={(field, value) => setFormState((current) => ({ ...current, [field]: value }))}
                onAddressChange={updateAddressField}
                onTotalsChange={updateTotalsField}
                onItemChange={updateItem}
                onAddItem={addItem}
                onRemoveItem={removeItem}
              />
            ) : (
              <OrderDetailPanel
                selectedOrder={selectedOrder}
                canWrite={can('orders:write')}
                acting={acting}
                onEdit={() => handleStartEdit(selectedOrder)}
                onDispatch={handleDispatch}
                onConvertToSale={handleConvertToSale}
                formatDateTime={formatDateTime}
              />
            )}
          </div>
        </div>
      </SurfaceCard>
    </section>
  );
}

export default OrdersModule;
