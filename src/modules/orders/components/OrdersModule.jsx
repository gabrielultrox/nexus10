import { useEffect, useMemo, useRef, useState } from 'react';

import MetricCard from '../../../components/common/MetricCard';
import SurfaceCard from '../../../components/common/SurfaceCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import { formatCurrencyBRL, getOrderDomainStatusLabel, getPaymentMethodLabel } from '../../../services/commerce';
import { subscribeToCustomers } from '../../../services/customerService';
import { getFriendlyErrorMessage } from '../../../services/errorMessages';
import { firebaseReady } from '../../../services/firebase';
import {
  convertOrderToSale,
  createOrder,
  deleteOrder as deleteOrderRecord,
  getOrderById,
  markOrderAsDispatched,
  subscribeToOrders,
  updateOrder,
} from '../../../services/orders';
import { subscribeToProducts } from '../../../services/productService';
import { playDestructive, playError, playNotification, playPdvSuccess } from '../../../services/soundManager';
import OrderDetailPanel from './OrderDetailPanel';
import OrderFormPanel from './OrderFormPanel';
import Select from '../../../components/ui/Select';
import EmptyState from '../../../components/ui/EmptyState';
import DestructiveIconButton from '../../../components/ui/DestructiveIconButton';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';

const statusOptions = ['OPEN', 'DISPATCHED', 'CONVERTED_TO_SALE', 'CANCELLED'];
const sourceOptions = ['BALCAO', 'ZE_DELIVERY', 'ANOTA_AI', 'IFOOD'];
const paymentOptions = ['DINHEIRO', 'ONLINE', 'CREDITO', 'DEBITO', 'PIX'];

function createEmptyItem() {
  return {
    productId: '',
    productSnapshot: null,
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
        productSnapshot: item.productSnapshot
          ? {
            id: item.productSnapshot.id ?? item.productId ?? '',
            name: item.productSnapshot.name ?? 'Produto',
            category: item.productSnapshot.category ?? '',
            sku: item.productSnapshot.sku ?? '',
          }
          : null,
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
      : [createEmptyItem()],
  };
}

function OrdersModule({
  orderId,
  viewMode,
  formResetToken,
  onOpenDetail,
  onOpenEdit,
  onOpenList,
}) {
  const { can, session } = useAuth();
  const { currentStoreId, tenantId } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [formState, setFormState] = useState(() => createInitialFormState());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const initializedViewRef = useRef('');
  const [freshOrderIds, setFreshOrderIds] = useState(() => new Set());
  const [pendingAction, setPendingAction] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const previousVisibleOrderIdsRef = useRef([]);
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
      setOrders([]);
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
        setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel carregar os pedidos.'));
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [currentStoreId]);

  useEffect(() => {
    if (!firebaseReady || !currentStoreId) {
      setCustomers([]);
      setProducts([]);
      setCatalogLoading(false);
      return undefined;
    }

    let customersResolved = false;
    let productsResolved = false;

    function resolveCustomers() {
      if (!customersResolved) {
        customersResolved = true;
        setCatalogLoading((current) => (productsResolved ? false : current));
      }
    }

    function resolveProducts() {
      if (!productsResolved) {
        productsResolved = true;
        setCatalogLoading((current) => (customersResolved ? false : current));
      }
    }

    setCatalogLoading(true);

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

  const internalOrders = useMemo(() => orders.filter((order) => !order.isExternal), [orders]);

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

  useEffect(() => {
    const previousIds = previousVisibleOrderIdsRef.current;
    const nextIds = visibleOrders.map((order) => order.id);
    const nextIdSet = new Set(nextIds);
    const freshIds = nextIds.filter((id) => !previousIds.includes(id));

    if (freshIds.length > 0) {
      setFreshOrderIds((current) => {
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
          setFreshOrderIds((current) => {
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

    setFreshOrderIds((current) => {
      const next = new Set();
      current.forEach((id) => {
        if (nextIdSet.has(id)) {
          next.add(id);
        }
      });
      return next.size === current.size ? current : next;
    });

    previousVisibleOrderIdsRef.current = nextIds;
  }, [visibleOrders]);

  const selectedOrder = useMemo(
    () => internalOrders.find((order) => order.id === orderId) ?? null,
    [internalOrders, orderId],
  );

  const editingOrderId = viewMode === 'edit' ? selectedOrder?.id ?? orderId ?? null : null;
  const showFormLoading = (viewMode === 'create' || viewMode === 'edit') && catalogLoading;
  const showDetailLoading = viewMode === 'detail' && loading && Boolean(orderId) && !selectedOrder;

  useEffect(() => {
    const nextViewKey = `${viewMode}:${orderId ?? 'new'}:${formResetToken ?? 'default'}`;

    if (initializedViewRef.current === nextViewKey) {
      return;
    }

    if (viewMode === 'create') {
      setFormState(createInitialFormState());
      initializedViewRef.current = nextViewKey;
      return;
    }

    if (viewMode === 'edit' && selectedOrder) {
      setFormState(mapOrderToForm(selectedOrder));
      initializedViewRef.current = nextViewKey;
    }
  }, [formResetToken, orderId, selectedOrder, viewMode]);

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
        description: 'total dominio',
        badgeText: 'dominio',
        variant: 'neutral',
      },
      {
        label: 'Abertos',
        value: String(open).padStart(2, '0'),
        description: 'na fila',
        badgeText: 'fila',
        variant: 'warning',
      },
      {
        label: 'Despachados',
        value: String(dispatched).padStart(2, '0'),
        description: 'em envio',
        badgeText: 'envio',
        variant: 'info',
      },
      {
        label: 'Viraram venda',
        value: String(converted).padStart(2, '0'),
        description: 'concluido',
        badgeText: 'venda',
        variant: 'success',
      },
    ];
  }, [internalOrders]);

  function getInlineActionConfig(order) {
    if (order.domainStatus === 'OPEN') {
      return {
        kind: 'launch-sale',
        label: 'Lancar venda',
        tone: 'success',
        confirmMessage: `Confirmar lancamento do pedido ${order.number} como venda?`,
        successMessage: `Venda lancada — ${order.number}`,
      };
    }

    if (order.domainStatus === 'DISPATCHED') {
      return {
        kind: 'confirm-delivery',
        label: 'Confirmar entrega',
        tone: 'info',
        confirmMessage: `Confirmar entrega do pedido ${order.number}?`,
        successMessage: `Entrega confirmada — ${order.number}`,
      };
    }

    return null;
  }

  function getListStatusLabel(order) {
    if (order.domainStatus === 'CONVERTED_TO_SALE') {
      return 'Venda lancada';
    }

    return getOrderDomainStatusLabel(order.domainStatus);
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
            productSnapshot: product
              ? {
                id: product.id,
                name: product.name ?? 'Produto',
                category: product.category ?? '',
                sku: product.sku ?? '',
              }
              : null,
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
    if (persistedDraftItems.length === 0) {
      throw new Error('Adicione pelo menos um produto valido para salvar o pedido.');
    }

    if (persistedDraftItems.some((item) => !(item.productId || item.product?.id || item.productSnapshot?.id || item.productSnapshot?.name))) {
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
      setOrders((current) => {
        const next = current.filter((entry) => entry.id !== order.id);
        return [order, ...next];
      });
    }

    return order;
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
      playPdvSuccess();
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel despachar o pedido.'));
      playError();
    } finally {
      setActing(false);
    }
  }

  async function handleConvertToSale(order = selectedOrder, options = {}) {
    if (!order || !currentStoreId) {
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
        orderId: order.id,
        createdBy: session,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId,
        actor: buildAuditActor(session),
        action: 'order.converted_to_sale',
        entityType: 'order',
        entityId: order.id,
        description: `Pedido ${order.number} gerou a venda ${saleId}.`,
      });
      await refreshSelectedOrder(order.id);
      setFeedbackMessage(`Venda ${saleId} gerada com sucesso.`);
      if (options.toastMessage) {
        toast.success(options.toastMessage);
      }
      playPdvSuccess();
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel gerar a venda.'));
      if (options.errorToastMessage) {
        toast.error(options.errorToastMessage);
      }
      playError();
    } finally {
      setActing(false);
    }
  }

  async function handleInlineActionConfirm(order, actionConfig, event) {
    event.stopPropagation();
    await handleConvertToSale(order, {
      toastMessage: actionConfig.successMessage,
      errorToastMessage: `Falha ao atualizar ${order.number}`,
    });
    setPendingAction(null);
  }

  async function handleDeleteOrder(order, event) {
    event.stopPropagation();

    if (!can('orders:write')) {
      setErrorMessage('Seu perfil nao pode excluir pedidos.');
      playError();
      return;
    }

    if (order.isExternal) {
      setErrorMessage('Pedidos externos nao podem ser excluidos por esta tela.');
      playNotification();
      return;
    }

    const confirmed = await confirm.ask({
      title: 'Excluir pedido',
      message: `Confirma a exclusao do pedido ${order.number}?`,
      confirmLabel: 'Excluir pedido',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setDeletingOrderId(order.id);
    setErrorMessage('');
    setFeedbackMessage('');

    try {
      await deleteOrderRecord({
        storeId: currentStoreId,
        orderId: order.id,
      });
      setOrders((current) => current.filter((entry) => entry.id !== order.id));
      setFeedbackMessage(`Pedido ${order.number} excluido com sucesso.`);
      toast.success(`Pedido ${order.number} excluido`);
      playDestructive();
      if (order.id === orderId) {
        onOpenList();
      }
    } catch (error) {
      if (String(error?.message ?? '').includes('Pedido nao encontrado')) {
        setOrders((current) => current.filter((entry) => entry.id !== order.id));
        setFeedbackMessage(`Pedido ${order.number} removido da lista local.`);
        setErrorMessage('');
        toast.info(`Pedido ${order.number} removido da lista local`);
        playNotification();
        if (order.id === orderId) {
          onOpenList();
        }
        return;
      }

      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel excluir o pedido.'));
      playError();
    } finally {
      setDeletingOrderId(null);
    }
  }

  if (!firebaseReady) {
    return (
      <SurfaceCard title="Pedidos">
        <EmptyState message="Firebase nao configurado" />
      </SurfaceCard>
    );
  }

  if (!currentStoreId) {
    return (
      <SurfaceCard title="Pedidos">
        <EmptyState message="Nenhuma loja ativa" />
      </SurfaceCard>
    );
  }

  async function handleSubmitAndNavigate(event) {
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
      let nextOrderId = editingOrderId;
      let auditDescription = '';

      if (editingOrderId) {
        await updateOrder({
          storeId: currentStoreId,
          orderId: editingOrderId,
          values,
        });
        auditDescription = `Pedido ${selectedOrder?.number ?? editingOrderId} atualizado.`;
        setFeedbackMessage('Pedido atualizado com sucesso.');
      } else {
        nextOrderId = await createOrder({
          storeId: currentStoreId,
          tenantId,
          values,
          createdBy: session,
        });
        auditDescription = `Novo pedido ${values.source} criado com total ${formatCurrencyBRL(calculatedTotals.total)}.`;
        setFeedbackMessage('Pedido cadastrado com sucesso.');
      }

      playPdvSuccess();
      if (nextOrderId) {
        onOpenDetail(nextOrderId);
      } else {
        onOpenList();
      }
      setFormState(createInitialFormState());

      if (nextOrderId) {
        void refreshSelectedOrder(nextOrderId).catch(() => null);
        void recordAuditLog({
          storeId: currentStoreId,
          tenantId,
          actor: buildAuditActor(session),
          action: editingOrderId ? 'order.updated' : 'order.created',
          entityType: 'order',
          entityId: nextOrderId,
          description: auditDescription,
        }).catch(() => null);
      }
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Nao foi possivel salvar o pedido.'));
      playError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="entity-module orders-domain orders-domain--screen">
      {viewMode === 'list' ? (
        <>
          <div className="card-grid">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                description={metric.description}
                badgeText={metric.badgeText}
                variant={metric.variant}
              />
            ))}
          </div>

          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          <SurfaceCard title="Pedidos comerciais e operacionais">
            <div className="entity-toolbar-shell">
              <div className="entity-toolbar-copy">
                <p className="text-section-title">Busca e acompanhamento</p>
                <p className="text-body">Filtre por cliente, codigo ou status para localizar o pedido certo com rapidez.</p>
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
                  <Select
                    id="orders-status-filter"
                    className="ui-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">Todos</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{getOrderDomainStatusLabel(status)}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="orders-domain__list-shell orders-domain__list-shell--full">
              {loading ? (
                <EmptyState message="Carregando pedidos" />
              ) : visibleOrders.length === 0 ? (
                <EmptyState message="Nenhum pedido encontrado" />
              ) : (
                <div className="entity-table-wrap">
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
                        <th>Acao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order, index) => {
                        const actionConfig = getInlineActionConfig(order);
                        const isPendingAction = pendingAction?.orderId === order.id;
                        const canDeleteOrder = !order.isExternal && order.saleStatus !== 'LAUNCHED' && order.domainStatus !== 'CONVERTED_TO_SALE';

                        return (
                          <tr
                            key={order.id}
                            className={[
                              freshOrderIds.has(order.id) ? 'ui-table__row-fresh' : 'ui-table__row-enter',
                              order.id === orderId ? 'entity-table__row--selected' : '',
                              isPendingAction ? 'orders-domain__row--action-open' : '',
                            ].filter(Boolean).join(' ')}
                            style={{ '--row-delay': `${Math.min(index * 40, 240)}ms` }}
                            onClick={() => onOpenDetail(order.id)}
                          >
                            <td className="ui-table__cell--strong">{order.number}</td>
                            <td>{order.origin}</td>
                            <td>{order.customerName}</td>
                            <td className="ui-table__cell--numeric">{order.total}</td>
                            <td>
                              <span className={`ui-badge ${order.domainStatus === 'OPEN' ? 'ui-badge--warning' : order.domainStatus === 'DISPATCHED' ? 'ui-badge--info' : order.domainStatus === 'CONVERTED_TO_SALE' ? 'ui-badge--success' : 'ui-badge--danger'}`}>
                                {getListStatusLabel(order)}
                              </span>
                            </td>
                            <td>
                              <span className={`ui-badge ${order.saleStatus === 'LAUNCHED' ? 'ui-badge--success' : 'ui-badge--info'}`}>
                                {order.saleStatus === 'LAUNCHED' ? 'Lancada' : 'Nao lancada'}
                              </span>
                            </td>
                            <td className="ui-table__cell--muted">{formatDateTime(order.createdAt)}</td>
                            <td className="orders-domain__action-cell">
                              <div className={`orders-domain__row-actions ${isPendingAction ? 'orders-domain__row-actions--visible' : ''}`}>
                                {actionConfig ? (
                                  isPendingAction ? (
                                    <div className="orders-domain__inline-confirm" onClick={(event) => event.stopPropagation()}>
                                      <p>{actionConfig.confirmMessage}</p>
                                      <div className="orders-domain__inline-confirm-actions">
                                        <button
                                          type="button"
                                          className="orders-domain__inline-button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setPendingAction(null);
                                          }}
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          className={`orders-domain__inline-button orders-domain__inline-button--${actionConfig.tone}`}
                                          onClick={(event) => handleInlineActionConfirm(order, actionConfig, event)}
                                        >
                                          Confirmar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={`orders-domain__inline-button orders-domain__inline-button--${actionConfig.tone}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setPendingAction({ orderId: order.id, kind: actionConfig.kind });
                                      }}
                                    >
                                      {actionConfig.label}
                                    </button>
                                  )
                                ) : order.domainStatus === 'CONVERTED_TO_SALE' ? (
                                  <span className="orders-domain__row-complete">Concluido</span>
                                ) : (
                                  <span className="orders-domain__row-complete">--</span>
                                )}
                                {canDeleteOrder ? (
                                  <DestructiveIconButton
                                    className="orders-domain__delete-button"
                                    label={`Excluir pedido ${order.number}`}
                                    disabled={deletingOrderId === order.id}
                                    onClick={(event) => handleDeleteOrder(order, event)}
                                  />
                                ) : (
                                  <span className="orders-domain__row-complete">
                                    --
                                  </span>
                                )}
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

      {viewMode === 'create' || viewMode === 'edit' ? (
        <>
          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          {showFormLoading ? (
            <SurfaceCard title={editingOrderId ? 'Editar pedido' : 'Novo pedido'}>
              <EmptyState message="Carregando apoio do formulario" />
            </SurfaceCard>
          ) : (
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
              onCancel={() => (editingOrderId ? onOpenDetail(editingOrderId) : onOpenList())}
              onSubmit={handleSubmitAndNavigate}
              onCustomerChange={handleCustomerChange}
              onFieldChange={(field, value) => setFormState((current) => ({ ...current, [field]: value }))}
              onAddressChange={updateAddressField}
              onTotalsChange={updateTotalsField}
              onItemChange={updateItem}
              onAddItem={addItem}
              onRemoveItem={removeItem}
            />
          )}
        </>
      ) : null}

      {viewMode === 'detail' ? (
        <>
          {feedbackMessage ? <div className="auth-error auth-error--success">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

          <OrderDetailPanel
            selectedOrder={selectedOrder}
            isLoading={showDetailLoading}
            requestedOrderId={orderId}
            canWrite={can('orders:write')}
            acting={acting}
            onEdit={() => selectedOrder && onOpenEdit(selectedOrder.id)}
            onDispatch={handleDispatch}
            onConvertToSale={handleConvertToSale}
            formatDateTime={formatDateTime}
          />
        </>
      ) : null}
    </section>
  );
}

export default OrdersModule;


