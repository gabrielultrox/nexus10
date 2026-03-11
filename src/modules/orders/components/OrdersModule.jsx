import { useEffect, useMemo, useState } from 'react';

import SurfaceCard from '../../../components/common/SurfaceCard';
import IFoodWidgetBridge from '../../../components/integrations/IFoodWidgetBridge';
import { useAuth } from '../../../contexts/AuthContext';
import { useStore } from '../../../contexts/StoreContext';
import { buildAuditActor, recordAuditLog } from '../../../services/auditLog';
import {
  subscribeToExternalOrderEvents,
  subscribeToExternalOrderTracking,
  subscribeToIntegrationLogs,
  subscribeToIntegrationMerchants,
} from '../../../services/externalOrders';
import { getNextOrderStatus, subscribeToOrders, updateOrderStatus } from '../../../services/orders';
import { playError, playSuccess } from '../../../services/soundManager';
import { orderStatusMap } from '../schemas/orderSchema';
import { countOrdersByStatus, filterOrders, groupOrdersByStatus } from '../utils/orderFilters';
import OrdersBoard from './OrdersBoard';
import OrdersFilters from './OrdersFilters';
import OrdersStats from './OrdersStats';

const initialFilters = {
  search: '',
  status: 'all',
  origin: 'all',
  highPriorityOnly: false,
};

function OrdersModule() {
  const { session } = useAuth();
  const { currentStoreId } = useStore();
  const [filters, setFilters] = useState(initialFilters);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedOrderEvents, setSelectedOrderEvents] = useState([]);
  const [selectedOrderTracking, setSelectedOrderTracking] = useState([]);
  const [integrationErrors, setIntegrationErrors] = useState([]);
  const [ifoodMerchants, setIfoodMerchants] = useState([]);

  useEffect(() => {
    if (!currentStoreId) {
      setOrders([]);
      return undefined;
    }

    setErrorMessage('');

    return subscribeToOrders(
      currentStoreId,
      setOrders,
      (error) => {
        setErrorMessage(error.message ?? 'Nao foi possivel carregar os pedidos.');
      },
    );
  }, [currentStoreId]);

  useEffect(() => {
    if (!currentStoreId) {
      setIfoodMerchants([]);
      return undefined;
    }

    return subscribeToIntegrationMerchants(currentStoreId, 'ifood', setIfoodMerchants, () => {});
  }, [currentStoreId]);

  const filteredOrders = useMemo(() => filterOrders(orders, filters), [filters, orders]);
  const groupedOrders = useMemo(() => groupOrdersByStatus(filteredOrders), [filteredOrders]);
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );
  const selectedMerchantConfig = useMemo(
    () => ifoodMerchants.find((merchant) => merchant.merchantId === selectedOrder?.merchantId) ?? null,
    [ifoodMerchants, selectedOrder?.merchantId],
  );

  useEffect(() => {
    if (!currentStoreId || !selectedOrder?.isExternal || !selectedOrder.externalOrderId) {
      setSelectedOrderEvents([]);
      setSelectedOrderTracking([]);
      setIntegrationErrors([]);
      return undefined;
    }

    const unsubscribeEvents = subscribeToExternalOrderEvents(
      currentStoreId,
      selectedOrder.externalOrderId,
      setSelectedOrderEvents,
      () => {},
    );
    const unsubscribeTracking = subscribeToExternalOrderTracking(
      currentStoreId,
      selectedOrder.externalOrderId,
      setSelectedOrderTracking,
      () => {},
    );
    const unsubscribeLogs = subscribeToIntegrationLogs(
      currentStoreId,
      'ifood',
      (logs) => {
        setIntegrationErrors(
          logs.filter((log) => log.externalOrderId === selectedOrder.externalOrderId && log.level !== 'info').slice(0, 5),
        );
      },
      () => {},
    );

    return () => {
      unsubscribeEvents?.();
      unsubscribeTracking?.();
      unsubscribeLogs?.();
    };
  }, [currentStoreId, selectedOrder?.externalOrderId, selectedOrder?.isExternal]);

  const stats = useMemo(
    () => [
      {
        id: 'all',
        label: 'Pedidos ativos',
        value: orders.filter((order) => order.status !== 'delivered').length,
        meta: 'visao operacional da fila em tempo real',
      },
      {
        id: 'received',
        label: orderStatusMap.received.label,
        value: countOrdersByStatus(orders, 'received'),
        meta: 'entrada recente do fluxo',
      },
      {
        id: 'preparing',
        label: orderStatusMap.preparing.label,
        value: countOrdersByStatus(orders, 'preparing'),
        meta: 'em producao agora',
      },
      {
        id: 'out',
        label: orderStatusMap.out_for_delivery.label,
        value: countOrdersByStatus(orders, 'out_for_delivery'),
        meta: 'em deslocamento',
      },
    ],
    [orders],
  );

  async function handleAdvanceOrder(order) {
    if (order.isExternal) {
      return;
    }

    const nextStatus = getNextOrderStatus(order.status);

    if (!currentStoreId || !nextStatus) {
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      setErrorMessage('');
      await updateOrderStatus({
        storeId: currentStoreId,
        orderId: order.id,
        status: nextStatus,
      });
      await recordAuditLog({
        storeId: currentStoreId,
        tenantId: order.tenantId ?? null,
        actor: buildAuditActor(session),
        action: 'order.status_changed',
        entityType: 'order',
        entityId: order.id,
        description: `Pedido ${order.number} alterado de ${order.status} para ${nextStatus}.`,
      });
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel atualizar o pedido.');
      playError();
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <section className="orders-module">
      <OrdersStats items={stats} />

      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <SurfaceCard title="Leitura Rapida de Fila">
        <OrdersFilters filters={filters} onChange={setFilters} />
      </SurfaceCard>

      <OrdersBoard
        groupedOrders={groupedOrders}
        onAdvanceOrder={handleAdvanceOrder}
        onOpenDetails={(order) => setSelectedOrderId(order.id)}
        updatingOrderId={updatingOrderId}
      />

      {selectedOrder ? (
        <SurfaceCard title="Detalhes do pedido">
          <div className="orders-detail">
            <div className="orders-detail__grid">
              <div className="orders-detail__item">
                <span className="orders-detail__label">Pedido</span>
                <strong>{selectedOrder.number}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Cliente</span>
                <strong>{selectedOrder.customerName}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Bairro</span>
                <strong>{selectedOrder.neighborhood}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Entregador</span>
                <strong>{selectedOrder.courierName}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Origem</span>
                <strong>{selectedOrder.origin || 'Nao informada'}</strong>
              </div>
              {selectedOrder.isExternal ? (
                <div className="orders-detail__item">
                  <span className="orders-detail__label">Status iFood</span>
                  <strong>{selectedOrder.externalStatus || 'Nao informado'}</strong>
                </div>
              ) : null}
              {selectedOrder.isExternal ? (
                <div className="orders-detail__item">
                  <span className="orders-detail__label">Merchant</span>
                  <strong>{selectedOrder.merchantId || 'Nao informado'}</strong>
                </div>
              ) : null}
              <div className="orders-detail__item">
                <span className="orders-detail__label">Pagamento</span>
                <strong>{selectedOrder.paymentMethod || 'Nao informado'}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Criado em</span>
                <strong>{selectedOrder.createdAtLabel}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Ultima atualizacao</span>
                <strong>{selectedOrder.updatedAtLabel}</strong>
              </div>
              <div className="orders-detail__item">
                <span className="orders-detail__label">Total</span>
                <strong>{selectedOrder.total}</strong>
              </div>
              {selectedOrder.isExternal ? (
                <>
                  <div className="orders-detail__item">
                    <span className="orders-detail__label">Subtotal</span>
                    <strong>{selectedOrder.subtotal?.toFixed?.(2) ?? '0.00'}</strong>
                  </div>
                  <div className="orders-detail__item">
                    <span className="orders-detail__label">Entrega</span>
                    <strong>{selectedOrder.shipping?.toFixed?.(2) ?? '0.00'}</strong>
                  </div>
                  <div className="orders-detail__item">
                    <span className="orders-detail__label">Desconto</span>
                    <strong>{selectedOrder.discount?.toFixed?.(2) ?? '0.00'}</strong>
                  </div>
                </>
              ) : null}
              <div className="orders-detail__item orders-detail__item--full">
                <span className="orders-detail__label">Itens</span>
                <strong>{selectedOrder.itemsSummary}</strong>
              </div>
            </div>

            {selectedOrder.isExternal ? (
              <>
                <div className="orders-detail__grid" style={{ marginTop: '1rem' }}>
                  <div className="orders-detail__item orders-detail__item--full">
                    <span className="orders-detail__label">Timeline de eventos</span>
                    <strong>
                      {selectedOrderEvents.length > 0
                        ? selectedOrderEvents.map((event) => `${event.eventCode || event.eventFullCode} · ${event.createdAt}`).join(' | ')
                        : 'Nenhum evento sincronizado ainda.'}
                    </strong>
                  </div>
                  <div className="orders-detail__item orders-detail__item--full">
                    <span className="orders-detail__label">Tracking</span>
                    <strong>
                      {selectedOrderTracking.length > 0
                        ? selectedOrderTracking.map((entry) => `${entry.label} · ${entry.happenedAt}`).join(' | ')
                        : 'Nenhum tracking recebido ainda.'}
                    </strong>
                  </div>
                  <div className="orders-detail__item orders-detail__item--full">
                    <span className="orders-detail__label">Erros de sincronizacao</span>
                    <strong>
                      {integrationErrors.length > 0
                        ? integrationErrors.map((entry) => entry.message).join(' | ')
                        : selectedOrder.syncErrorMessage || 'Nenhum erro registrado.'}
                    </strong>
                  </div>
                </div>

                <IFoodWidgetBridge
                  merchantConfig={selectedMerchantConfig}
                  externalOrderId={selectedOrder.externalOrderId}
                />
              </>
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}
    </section>
  );
}

export default OrdersModule;
