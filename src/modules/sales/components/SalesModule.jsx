import { useEffect, useMemo, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { formatCurrencyBRL, getPaymentMethodLabel } from '../../../services/commerce';
import { subscribeToCustomers } from '../../../services/customerService';
import { firebaseReady } from '../../../services/firebase';
import { subscribeToProducts } from '../../../services/productService';
import {
  createDirectSale,
  getSaleById,
  getSaleStatusMeta,
  subscribeToSales,
  updateSaleStatus,
} from '../../../services/sales';
import { playError, playSuccess } from '../../../services/soundManager';
import SalesDetailPanel from './SalesDetailPanel';
import SalesFormPanel from './SalesFormPanel';
import {
  createEmptyItem,
  createInitialFormState,
  formatDateTime,
  isWithinPeriod,
  parseDecimal,
} from './salesModuleHelpers';

function SalesModule() {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [activeScreen, setActiveScreen] = useState('detail');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formState, setFormState] = useState(() => createInitialFormState());
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
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
        setErrorMessage(error.message ?? 'Nao foi possivel carregar as vendas.');
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

  useEffect(() => {
    if (!selectedSaleId && sales.length > 0) {
      setSelectedSaleId(sales[0].id);
    }

    if (selectedSaleId && !sales.some((sale) => sale.id === selectedSaleId)) {
      setSelectedSaleId(sales[0]?.id ?? null);
    }
  }, [sales, selectedSaleId]);

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

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );

  const metrics = useMemo(() => {
    const posted = sales.filter((sale) => sale.domainStatus === 'POSTED');
    const reversed = sales.filter((sale) => sale.domainStatus === 'REVERSED');
    const cancelled = sales.filter((sale) => sale.domainStatus === 'CANCELLED');
    const volume = posted.reduce((total, sale) => total + Number(sale.totals?.total ?? 0), 0);

    return [
      { label: 'Vendas', value: String(sales.length).padStart(2, '0'), meta: 'eventos reais que movem estoque e financeiro', badgeText: 'posted', badgeClass: 'ui-badge--info' },
      { label: 'Lancadas', value: String(posted.length).padStart(2, '0'), meta: 'impacto efetivo registrado no sistema', badgeText: 'ok', badgeClass: 'ui-badge--success' },
      { label: 'Estornadas/canceladas', value: String(reversed.length + cancelled.length).padStart(2, '0'), meta: 'casos que revertem ou bloqueiam o efeito da venda', badgeText: 'revisao', badgeClass: 'ui-badge--warning' },
      { label: 'Volume lancado', value: formatCurrencyBRL(volume), meta: 'total das vendas postadas', badgeText: 'financeiro', badgeClass: 'ui-badge--special' },
    ];
  }, [sales]);

  function resetForm() {
    setFormState(createInitialFormState());
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
      channel: formState.channel,
      customerId: selectedCustomer?.id ?? null,
      customerSnapshot: selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phoneDisplay ?? selectedCustomer.phone ?? '', neighborhood: selectedCustomer.neighborhood ?? '' } : undefined,
      items: draftItems.map((item) => ({ productId: item.productId, productSnapshot: { id: item.product?.id ?? item.productId, name: item.product?.name ?? 'Produto', category: item.product?.category ?? '', sku: item.product?.sku ?? '' }, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice })),
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
      setSelectedSaleId(sale.id);
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
      await refreshSelectedSale(saleId);
      setFeedbackMessage(`Venda ${saleId} lancada com sucesso.`);
      playSuccess();
      resetForm();
      setActiveScreen('detail');
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel lancar a venda.');
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
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar a venda.');
      playError();
    } finally {
      setActing(false);
    }
  }

  if (!firebaseReady || !currentStoreId) {
    return (
      <SurfaceCard title="Vendas">
        <div className="entity-empty-state">
          <p className="text-section-title">{firebaseReady ? 'Nenhuma loja ativa' : 'Firebase nao configurado'}</p>
          <p className="text-body">{firebaseReady ? 'Selecione uma loja antes de operar o dominio de vendas.' : 'Configure as variaveis VITE_FIREBASE_* para usar persistencia real.'}</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="entity-module sales-domain">
      <div className="card-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>

      <SurfaceCard title="Area de trabalho de vendas">
        <div className="sales-domain__header">
          <div className="sales-domain__copy">
            <p className="text-section-title">Lista de Vendas</p>
            <p className="text-body">Toda venda postada aqui derruba estoque, cria financeiro e registra auditoria.</p>
          </div>
          <div className="sales-domain__actions">
            <button type="button" className="ui-button ui-button--ghost" onClick={() => setActiveScreen('detail')}>Detalhe da venda</button>
            <button type="button" className="ui-button ui-button--primary" onClick={() => { resetForm(); setActiveScreen('create'); }} disabled={!can('sales:write')}>Nova venda</button>
          </div>
        </div>

        <div className="sales-domain__toolbar">
          <div className="ui-field"><label className="ui-label" htmlFor="sales-search">Buscar</label><input id="sales-search" className="ui-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Venda, pedido, cliente, pagamento ou canal" /></div>
          <div className="ui-field"><label className="ui-label" htmlFor="sales-status">Status</label><select id="sales-status" className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos</option><option value="POSTED">Lancadas</option><option value="REVERSED">Estornadas</option><option value="CANCELLED">Canceladas</option></select></div>
          <div className="ui-field"><label className="ui-label" htmlFor="sales-start-date">Inicio</label><input id="sales-start-date" className="ui-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
          <div className="ui-field"><label className="ui-label" htmlFor="sales-end-date">Fim</label><input id="sales-end-date" className="ui-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
        </div>

        {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
        {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

        <div className="sales-domain__layout">
          <div className="sales-domain__column">
            <div className="sales-domain__list-shell">
              {loading ? (
                <div className="entity-empty-state"><p className="text-section-title">Carregando vendas...</p></div>
              ) : visibleSales.length === 0 ? (
                <div className="entity-empty-state"><p className="text-section-title">Nenhuma venda encontrada</p><p className="text-body">Ajuste os filtros ou lance uma nova venda para preencher a lista.</p></div>
              ) : (
                <div className="entity-table-wrap">
                  <table className="ui-table">
                    <thead><tr><th>Venda</th><th>Origem</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Criada em</th></tr></thead>
                    <tbody>
                      {visibleSales.map((sale) => {
                        const statusMeta = getSaleStatusMeta(sale.domainStatus);
                        return (
                          <tr key={sale.id} className={sale.id === selectedSale?.id ? 'entity-table__row--selected' : undefined} onClick={() => { setSelectedSaleId(sale.id); setActiveScreen('detail'); }}>
                            <td className="ui-table__cell--strong">{sale.number}</td>
                            <td>{sale.source === 'ORDER' ? `Pedido ${sale.orderId ?? '-'}` : 'Venda direta'}</td>
                            <td>{sale.customerSnapshot?.name || 'Cliente avulso'}</td>
                            <td className="ui-table__cell--numeric">{formatCurrencyBRL(sale.totals?.total ?? 0)}</td>
                            <td>{sale.paymentMethodLabel}</td>
                            <td><span className={`ui-badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span></td>
                            <td>{formatDateTime(sale.createdAtDate ?? sale.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="sales-domain__column">
            {activeScreen === 'create' ? (
              <SalesFormPanel
                canWrite={can('sales:write')}
                customers={customers}
                products={products}
                formState={formState}
                saving={saving}
                draftItems={draftItems}
                calculatedTotals={calculatedTotals}
                onCancel={() => setActiveScreen('detail')}
                onSubmit={handleSubmit}
                onCustomerChange={handleCustomerChange}
                onFieldChange={(field, value) => setFormState((current) => ({ ...current, [field]: value }))}
                onAddressChange={(field, value) => setFormState((current) => ({ ...current, address: { ...current.address, [field]: value } }))}
                onTotalsChange={(field, value) => setFormState((current) => ({ ...current, totals: { ...current.totals, [field]: value } }))}
                onItemChange={(index, field, value) => setFormState((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex !== index ? item : field === 'productId' ? { ...item, productId: value, unitPrice: String(products.find((entry) => entry.id === value)?.price ?? '') } : { ...item, [field]: value }) }))}
                onAddItem={() => setFormState((current) => ({ ...current, items: [...current.items, createEmptyItem()] }))}
                onRemoveItem={(index) => setFormState((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}
              />
            ) : (
              <SalesDetailPanel
                selectedSale={selectedSale}
                canWrite={can('sales:write')}
                acting={acting}
                onReverse={() => handleStatusChange('REVERSED')}
                onCancel={() => handleStatusChange('CANCELLED')}
              />
            )}
          </div>
        </div>
      </SurfaceCard>
    </section>
  );
}

export default SalesModule;
