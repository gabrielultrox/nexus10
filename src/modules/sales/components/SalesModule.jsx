import { useEffect, useMemo, useRef, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { formatCurrencyBRL, getPaymentMethodLabel } from '../../../services/commerce';
import { subscribeToCustomers } from '../../../services/customerService';
import { getFriendlyErrorMessage } from '../../../services/errorMessages';
import { firebaseReady } from '../../../services/firebase';
import { subscribeToProducts } from '../../../services/productService';
import {
  createDirectSale,
  deleteSale as deleteSaleRecord,
  getSaleById,
  getSaleStatusMeta,
  subscribeToSales,
  updateSaleStatus,
} from '../../../services/sales';
import { playDestructive, playError, playPdvSuccess } from '../../../services/soundManager';
import Select from '../../../components/ui/Select';
import EmptyState from '../../../components/ui/EmptyState';
import DestructiveIconButton from '../../../components/ui/DestructiveIconButton';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import SalesDetailPanel from './SalesDetailPanel';
import SalesFormPanel from './SalesFormPanel';
import {
  createEmptyItem,
  createInitialFormState,
  formatDateTime,
  isWithinPeriod,
  parseDecimal,
} from './salesModuleHelpers';

function SalesModule({
  saleId,
  viewMode,
  formResetToken,
  onOpenDetail,
  onOpenList,
}) {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referenceDataLoading, setReferenceDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formState, setFormState] = useState(() => createInitialFormState());
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [freshSaleIds, setFreshSaleIds] = useState(() => new Set());
  const [deletingSaleId, setDeletingSaleId] = useState(null);
  const previousVisibleSaleIdsRef = useRef([]);
  const freshTimeoutsRef = useRef(new Map());

  useEffect(() => {
    const freshTimeouts = freshTimeoutsRef.current;

    return () => {
      freshTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      freshTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setSales([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    const unsubscribe = subscribeToSales(
      currentStoreId,
      (nextSales) => {
        setSales(nextSales);
        setLoading(false);
      },
      (error) => {
        setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel carregar as vendas.'));
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [currentStoreId]);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setCustomers([]);
      setProducts([]);
      setReferenceDataLoading(false);
      return undefined;
    }

    let customersResolved = false;
    let productsResolved = false;

    function resolveCustomers() {
      if (!customersResolved) {
        customersResolved = true;
        setReferenceDataLoading((current) => (productsResolved ? false : current));
      }
    }

    function resolveProducts() {
      if (!productsResolved) {
        productsResolved = true;
        setReferenceDataLoading((current) => (customersResolved ? false : current));
      }
    }

    setReferenceDataLoading(true);

    const unsubscribeCustomers = subscribeToCustomers(
      currentStoreId,
      (nextCustomers) => {
        setCustomers(nextCustomers);
        resolveCustomers();
      },
      (error) => {
        setErrorMessage((current) => current || getFriendlyErrorMessage(error, 'Nao foi possivel carregar os clientes.'));
        resolveCustomers();
      },
    );
    const unsubscribeProducts = subscribeToProducts(
      currentStoreId,
      (nextProducts) => {
        setProducts(nextProducts);
        resolveProducts();
      },
      (error) => {
        setErrorMessage((current) => current || getFriendlyErrorMessage(error, 'Nao foi possivel carregar os produtos.'));
        resolveProducts();
      },
    );

    return () => {
      unsubscribeCustomers?.();
      unsubscribeProducts?.();
    };
  }, [currentStoreId]);

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
        productSnapshot: item.productSnapshot ?? null,
        productId: item.productId,
        quantity,
        unitPrice,
        totalPrice: Number((quantity * unitPrice).toFixed(2)),
      };
    }),
    [formState.items, products],
  );

  const persistedDraftItems = useMemo(
    () => draftItems.filter((item) => item.productId || item.product?.id || item.productSnapshot?.id || item.productSnapshot?.name),
    [draftItems],
  );

  const calculatedTotals = useMemo(() => {
    const subtotal = Number(draftItems.reduce((total, item) => total + Number(item.totalPrice ?? 0), 0).toFixed(2));
    const freight = parseDecimal(formState.totals.freight);
    const extraAmount = parseDecimal(formState.totals.extraAmount);
    const discountPercent = parseDecimal(formState.totals.discountPercent);
    const explicitDiscountValue = parseDecimal(formState.totals.discountValue);
    const discountValue = explicitDiscountValue > 0 ? explicitDiscountValue : Number((subtotal * (discountPercent / 100)).toFixed(2));
    const total = Number((subtotal + freight + extraAmount - discountValue).toFixed(2));

    return { subtotal, freight, extraAmount, discountPercent, discountValue, total: Math.max(0, total) };
  }, [draftItems, formState.totals]);

  const visibleSales = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        sale.code,
        sale.id,
        sale.orderId,
        sale.customerSnapshot?.name,
        sale.customerSnapshot?.phone,
        sale.channelLabel,
        sale.paymentMethodLabel,
      ].join(' ').toLowerCase().includes(normalizedSearch);

      return (statusFilter === 'all' || sale.domainStatus === statusFilter)
        && isWithinPeriod(sale.createdAtDate ?? sale.createdAt, startDate, endDate)
        && matchesSearch;
    });
  }, [endDate, sales, searchTerm, startDate, statusFilter]);

  useEffect(() => {
    const previousIds = previousVisibleSaleIdsRef.current;
    const nextIds = visibleSales.map((sale) => sale.id);
    const nextIdSet = new Set(nextIds);
    const freshIds = nextIds.filter((id) => !previousIds.includes(id));

    if (freshIds.length > 0) {
      setFreshSaleIds((current) => {
        const next = new Set(current);
        freshIds.forEach((id) => next.add(id));
        return next;
      });

      freshIds.forEach((id) => {
        const existingTimeout = freshTimeoutsRef.current.get(id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeoutId = setTimeout(() => {
          setFreshSaleIds((current) => {
            if (!current.has(id)) {
              return current;
            }

            const next = new Set(current);
            next.delete(id);
            return next;
          });
          freshTimeoutsRef.current.delete(id);
        }, 600);

        freshTimeoutsRef.current.set(id, timeoutId);
      });
    }

    setFreshSaleIds((current) => {
      const next = new Set();
      current.forEach((id) => {
        if (nextIdSet.has(id)) {
          next.add(id);
        }
      });
      return next.size === current.size ? current : next;
    });

    previousVisibleSaleIdsRef.current = nextIds;
  }, [visibleSales]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === saleId) ?? null,
    [sales, saleId],
  );
  const showCreateLoading = viewMode === 'create' && referenceDataLoading;
  const showDetailLoading = viewMode === 'detail' && loading && Boolean(saleId) && !selectedSale;

  const metrics = useMemo(() => {
    const posted = sales.filter((sale) => sale.domainStatus === 'POSTED');
    const reversed = sales.filter((sale) => sale.domainStatus === 'REVERSED');
    const cancelled = sales.filter((sale) => sale.domainStatus === 'CANCELLED');
    const volume = posted.reduce((total, sale) => total + Number(sale.totals?.total ?? 0), 0);

    return [
      { label: 'Vendas', value: String(sales.length).padStart(2, '0'), description: 'total dominio', badgeText: 'dominio', variant: 'neutral' },
      { label: 'Lancadas', value: String(posted.length).padStart(2, '0'), description: 'concluido', badgeText: 'ok', variant: 'success' },
      { label: 'Estornadas/canceladas', value: String(reversed.length + cancelled.length).padStart(2, '0'), description: 'em revisao', badgeText: 'revisao', variant: 'warning' },
      { label: 'Volume lancado', value: formatCurrencyBRL(volume), description: 'financeiro', badgeText: 'volume', variant: 'success' },
    ];
  }, [sales]);

  function getSaleListActionStateLabel() {
    if (!can('sales:write')) {
      return 'Sem acoes';
    }

    return null;
  }

  useEffect(() => {
    if (viewMode === 'create') {
      setFormState(createInitialFormState());
    }
  }, [formResetToken, viewMode]);

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
    if (persistedDraftItems.length === 0) {
      throw new Error('Adicione pelo menos um produto valido para lancar a venda.');
    }

    if (persistedDraftItems.some((item) => !(item.productId || item.product?.id || item.productSnapshot?.id || item.productSnapshot?.name))) {
      throw new Error('Selecione um produto valido para todos os itens.');
    }

    return {
      channel: formState.channel,
      customerId: selectedCustomer?.id ?? null,
      customerSnapshot: selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phoneDisplay ?? selectedCustomer.phone ?? '', neighborhood: selectedCustomer.neighborhood ?? '' } : undefined,
      items: persistedDraftItems.map((item) => ({
        productId: item.productId || item.product?.id || item.productSnapshot?.id || null,
        productSnapshot: {
          id: item.product?.id ?? item.productSnapshot?.id ?? item.productId ?? null,
          name: item.product?.name ?? item.productSnapshot?.name ?? 'Produto',
          category: item.product?.category ?? item.productSnapshot?.category ?? '',
          sku: item.product?.sku ?? item.productSnapshot?.sku ?? '',
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      totals: calculatedTotals,
      paymentMethod: formState.paymentMethod,
      payment: { method: formState.paymentMethod, label: getPaymentMethodLabel(formState.paymentMethod), amount: calculatedTotals.total },
      address: { neighborhood: formState.address.neighborhood || selectedCustomer?.neighborhood || '', addressLine: formState.address.addressLine || selectedCustomer?.addressLine || '', reference: formState.address.reference || selectedCustomer?.reference || '', complement: formState.address.complement },
      notes: formState.notes,
    };
  }

  async function refreshSelectedSale(saleId) {
    if (!currentStoreId || !saleId) {
      return null;
    }

    const sale = await getSaleById({ storeId: currentStoreId, saleId });
    if (sale) {
      setSales((current) => {
        const next = current.filter((entry) => entry.id !== sale.id);
        return [sale, ...next];
      });
    }
    return sale;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!can('sales:write')) {
      setErrorMessage('Seu perfil nao pode criar vendas.');
      playError();
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      const saleId = await createDirectSale({ storeId: currentStoreId, tenantId, values: buildPayload(), createdBy: session });
      setFeedbackMessage(`Venda ${saleId} lancada com sucesso.`);
      playPdvSuccess();
      onOpenDetail(saleId);
      setFormState(createInitialFormState());
      void refreshSelectedSale(saleId).catch(() => null);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel lancar a venda.'));
      playError();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedSale || !currentStoreId) {
      return;
    }

    setActing(true);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await updateSaleStatus({ storeId: currentStoreId, saleId: selectedSale.id, status: nextStatus, actor: session });
      await refreshSelectedSale(selectedSale.id);
      setFeedbackMessage(`Venda ${selectedSale.code ?? selectedSale.id} atualizada para ${getSaleStatusMeta(nextStatus).label}.`);
      playPdvSuccess();
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel atualizar a venda.'));
      playError();
    } finally {
      setActing(false);
    }
  }

  async function handleDeleteSale(sale, event) {
    event.stopPropagation();

    if (!can('sales:write')) {
      setErrorMessage('Seu perfil nao pode excluir vendas.');
      playError();
      return;
    }

    const confirmed = await confirm.ask({
      title: 'Excluir venda',
      message: `Confirma a exclusao da venda ${sale.number}?`,
      confirmLabel: 'Excluir venda',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setDeletingSaleId(sale.id);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await deleteSaleRecord({
        storeId: currentStoreId,
        saleId: sale.id,
      });
      setSales((current) => current.filter((entry) => entry.id !== sale.id));
      setFeedbackMessage(`Venda ${sale.number} excluida com sucesso.`);
      toast.success(`Venda ${sale.number} excluida`);
      playDestructive();
      if (sale.id === saleId) {
        onOpenList();
      }
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel excluir a venda.'));
      playError();
    } finally {
      setDeletingSaleId(null);
    }
  }

  if (!firebaseReady || !currentStoreId) {
    return (
      <SurfaceCard title="Vendas">
        <EmptyState message={firebaseReady ? 'Nenhuma loja ativa' : 'Firebase nao configurado'} />
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module sales-domain sales-domain--screen">
      {viewMode === 'list' ? (
        <>
          <div className="card-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>

          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          <SurfaceCard title="Vendas postadas">
            <div className="sales-domain__toolbar">
              <div className="ui-field">
                <label className="ui-label" htmlFor="sales-search">Buscar</label>
                <input id="sales-search" className="ui-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Venda, pedido, cliente, pagamento ou canal" />
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="sales-status">Status</label>
                <Select id="sales-status" className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  <option value="POSTED">Lancadas</option>
                  <option value="REVERSED">Estornadas</option>
                  <option value="CANCELLED">Canceladas</option>
                </Select>
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="sales-start-date">Inicio</label>
                <input id="sales-start-date" className="ui-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="ui-field">
                <label className="ui-label" htmlFor="sales-end-date">Fim</label>
                <input id="sales-end-date" className="ui-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>

            <div className="sales-domain__list-shell sales-domain__list-shell--full">
              {loading ? (
                <EmptyState message="Carregando vendas" />
              ) : visibleSales.length === 0 ? (
                <EmptyState message="Nenhuma venda encontrada" />
              ) : (
                <div className="entity-table-wrap">
                  <table className="ui-table">
                    <thead><tr><th>Venda</th><th>Origem</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Criada em</th><th>Acao</th></tr></thead>
                    <tbody>
                      {visibleSales.map((sale, index) => {
                        const statusMeta = getSaleStatusMeta(sale.domainStatus);
                        const canDeleteSale = can('sales:write');
                        const actionStateLabel = getSaleListActionStateLabel();
                        return (
                          <tr
                            key={sale.id}
                            className={`${freshSaleIds.has(sale.id) ? 'ui-table__row-fresh' : 'ui-table__row-enter'}${sale.id === saleId ? ' entity-table__row--selected' : ''}`}
                            style={{ '--row-delay': `${Math.min(index * 40, 240)}ms` }}
                            onClick={() => onOpenDetail(sale.id)}
                          >
                            <td className="ui-table__cell--strong">{sale.number}</td>
                            <td className="ui-table__cell--muted">{sale.source === 'ORDER' ? `Pedido ${sale.orderId ?? '-'}` : 'Venda direta'}</td>
                            <td>{sale.customerSnapshot?.name || 'Cliente avulso'}</td>
                            <td className="ui-table__cell--numeric">{formatCurrencyBRL(sale.totals?.total ?? 0)}</td>
                            <td className="ui-table__cell--muted">{sale.paymentMethodLabel}</td>
                            <td><span className={`ui-badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span></td>
                            <td className="ui-table__cell--muted">{formatDateTime(sale.createdAtDate ?? sale.createdAt)}</td>
                            <td className="orders-domain__action-cell">
                              <div className="orders-domain__row-actions orders-domain__row-actions--visible">
                                {canDeleteSale ? (
                                  <DestructiveIconButton
                                    className="orders-domain__delete-button"
                                    label={`Excluir venda ${sale.number}`}
                                    disabled={deletingSaleId === sale.id}
                                    onClick={(event) => handleDeleteSale(sale, event)}
                                  />
                                ) : actionStateLabel ? (
                                  <span className="orders-domain__row-complete">
                                    {actionStateLabel}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SurfaceCard>
        </>
      ) : null}

      {viewMode === 'create' ? (
        <>
          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          {showCreateLoading ? (
            <SurfaceCard title="Nova venda">
              <EmptyState message="Carregando apoio do formulario" />
            </SurfaceCard>
          ) : (
            <SalesFormPanel
              canWrite={can('sales:write')}
              customers={customers}
              products={products}
              formState={formState}
              saving={saving}
              draftItems={draftItems}
              calculatedTotals={calculatedTotals}
              onCancel={onOpenList}
              onSubmit={handleSubmit}
              onCustomerChange={handleCustomerChange}
              onFieldChange={(field, value) => setFormState((current) => ({ ...current, [field]: value }))}
              onAddressChange={(field, value) => setFormState((current) => ({ ...current, address: { ...current.address, [field]: value } }))}
              onTotalsChange={(field, value) => setFormState((current) => ({ ...current, totals: { ...current.totals, [field]: value } }))}
              onItemChange={(index, field, value) => setFormState((current) => ({ ...current, items: current.items.map((item, itemIndex) => {
                if (itemIndex !== index) {
                  return item;
                }

                if (field === 'productId') {
                  const product = products.find((entry) => entry.id === value);

                  return {
                    ...item,
                    productId: value,
                    productSnapshot: product ? {
                      id: product.id,
                      name: product.name ?? 'Produto',
                      category: product.category ?? '',
                      sku: product.sku ?? '',
                    } : null,
                    unitPrice: String(product?.price ?? ''),
                  };
                }

                return { ...item, [field]: value };
              }) }))}
              onAddItem={() => setFormState((current) => ({ ...current, items: [...current.items, createEmptyItem()] }))}
              onRemoveItem={(index) => setFormState((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}
            />
          )}
        </>
      ) : null}

      {viewMode === 'detail' ? (
        <>
          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          <SalesDetailPanel
            selectedSale={selectedSale}
            isLoading={showDetailLoading}
            requestedSaleId={saleId}
            canWrite={can('sales:write')}
            acting={acting}
            onReverse={() => handleStatusChange('REVERSED')}
            onCancel={() => handleStatusChange('CANCELLED')}
          />
        </>
      ) : null}
    </section>
  );
}

export default SalesModule;


