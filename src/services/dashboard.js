import { getFinanceEntryDirection, isFinanceEntryActive, subscribeToFinancialEntries } from './finance';
import { isOrderClosedStatus, isSalePosted } from './commerce';
import { firebaseDb, firebaseReady, canUseRemoteSync } from './firebase';
import { subscribeToInventoryItems } from './inventory';
import { loadLocalRecords, loadResettableLocalRecords } from './localAccess';
import { courierSeedRecords } from './operationsSeedData';
import { subscribeToOrders } from './orders';
import { subscribeToSales } from './sales';

const delayedOrderThresholdMinutes = 35;

function asDate(value) {
  if (!value) {
    return null;
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
}

function parseMoney(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(parseMoney(value));
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));
}

function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}h`;
}

function summarizeProductName(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length <= 3) {
    return words.join(' ')
  }

  return `${words.slice(0, 3).join(' ')}...`
}

function buildDateLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function getDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWithinPeriod(value, startDate, endDate) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return false;
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (dateValue < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (dateValue > end) {
      return false;
    }
  }

  return true;
}

function isOrderDelayed(order) {
  const createdAt = asDate(order.createdAt);

  if (!createdAt || isOrderClosedStatus(order.domainStatus ?? order.status)) {
    return false;
  }

  return (Date.now() - createdAt.getTime()) / 60000 >= delayedOrderThresholdMinutes;
}

function getToneByValue(value, warningThreshold = 0) {
  return value > warningThreshold ? 'red' : 'cyan';
}

function getStatusBadgeClass(status) {
  const normalized = String(status ?? '').toLowerCase();

  if (normalized.includes('rota')) {
    return 'ui-badge--info';
  }

  if (normalized.includes('reserva')) {
    return 'ui-badge--special';
  }

  if (normalized.includes('pendente')) {
    return 'ui-badge--warning';
  }

  return 'ui-badge--success';
}

function buildDailySalesSeries(sales, startDate, endDate) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < 14) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  if (dates.length === 0) {
    dates.push(new Date());
  }

  const totalsByDay = sales.reduce((accumulator, sale) => {
    const saleDate = asDate(sale.createdAt);

    if (!saleDate) {
      return accumulator;
    }

    const dayKey = getDayKey(saleDate);
    accumulator.set(dayKey, (accumulator.get(dayKey) ?? 0) + parseMoney(sale.total));
    return accumulator;
  }, new Map());

  return dates.map((date) => ({
    label: buildDateLabel(date),
    value: Number((totalsByDay.get(getDayKey(date)) ?? 0).toFixed(2)),
  }));
}

function buildHourlyOrdersSeries(orders, sales) {
  const source = orders.length > 0 ? orders : sales;
  const countsByHour = source.reduce((accumulator, item) => {
    const dateValue = asDate(item.createdAt);

    if (!dateValue) {
      return accumulator;
    }

    const hour = dateValue.getHours();
    accumulator.set(hour, (accumulator.get(hour) ?? 0) + 1);
    return accumulator;
  }, new Map());

  const populatedHours = Array.from(countsByHour.entries())
    .sort((left, right) => left[0] - right[0]);

  const selectedHours = populatedHours.length > 0
    ? populatedHours.slice(Math.max(populatedHours.length - 8, 0))
    : [[new Date().getHours(), 0]];

  return selectedHours.map(([hour, value]) => ({
    label: formatHourLabel(hour),
    value,
  }));
}

export function getDefaultDashboardPeriod() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 6);

  return {
    startDate: getDayKey(startDate),
    endDate: getDayKey(endDate),
  };
}

export function loadDashboardOperationalSources() {
  const scheduleRecords = loadResettableLocalRecords('nexus-module-schedule', [], 3);
  const machineChecklist = loadResettableLocalRecords('nexus-module-machine-history', [], 3);
  const changeRecords = loadLocalRecords('nexus-module-change', []);
  const advanceRecords = loadLocalRecords('nexus-module-advances', []);
  const occurrenceRecords = loadLocalRecords('nexus-module-occurrences', []);
  const courierRecords = loadLocalRecords('nexus-manual-couriers', courierSeedRecords);

  return {
    scheduleRecords,
    machineChecklist,
    changeRecords,
    advanceRecords,
    occurrenceRecords,
    courierRecords,
  };
}

export function subscribeToDashboardSources(storeId, handlers) {
  if (!firebaseReady || !firebaseDb || !storeId || !canUseRemoteSync()) {
    handlers.onSales?.([]);
    handlers.onOrders?.([]);
    handlers.onInventoryItems?.([]);
    handlers.onFinancialEntries?.([]);
    return () => {};
  }

  const unsubscribers = [];

  unsubscribers.push(subscribeToSales(storeId, handlers.onSales, handlers.onError));
  unsubscribers.push(subscribeToInventoryItems(storeId, handlers.onInventoryItems, handlers.onError));
  unsubscribers.push(subscribeToFinancialEntries(storeId, handlers.onFinancialEntries, handlers.onError));

  unsubscribers.push(subscribeToOrders(storeId, handlers.onOrders, handlers.onError));

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  };
}

export function buildDashboardData({
  sales,
  orders,
  financialEntries,
  inventoryItems,
  startDate,
  endDate,
  operations,
}) {
  const completedSales = sales.filter((sale) => (
    isSalePosted(sale.domainStatus ?? sale.status) && isWithinPeriod(sale.createdAt, startDate, endDate)
  ));
  const ordersInPeriod = orders.filter((order) => isWithinPeriod(order.createdAt, startDate, endDate));
  const delayedOrders = ordersInPeriod.filter(isOrderDelayed);
  const activeEntries = financialEntries.filter((entry) => (
    isWithinPeriod(entry.createdAt, startDate, endDate) && isFinanceEntryActive(entry)
  ));

  const totalSold = completedSales.reduce((total, sale) => total + parseMoney(sale.total), 0);
  const totalSalesCount = completedSales.length;
  const averageTicket = totalSalesCount > 0 ? totalSold / totalSalesCount : 0;
  const totalIncome = activeEntries
    .filter((entry) => getFinanceEntryDirection(entry) === 'entrada')
    .reduce((total, entry) => total + parseMoney(entry.amount), 0);
  const totalExpense = activeEntries
    .filter((entry) => getFinanceEntryDirection(entry) === 'saida')
    .reduce((total, entry) => total + parseMoney(entry.amount), 0);
  const lowStockItems = inventoryItems.filter(
    (item) => Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0),
  );
  const activeCouriers = operations.scheduleRecords.filter((record) => record.status !== 'Pendente');

  const productsMap = new Map();
  completedSales.forEach((sale) => {
    sale.items?.forEach((item) => {
      const itemName = item.productSnapshot?.name ?? item.name;
      const currentItem = productsMap.get(item.productId ?? itemName) ?? {
        id: item.productId ?? itemName,
        name: itemName,
        quantity: 0,
        revenue: 0,
      };

      currentItem.quantity += Number(item.quantity ?? 0);
      currentItem.revenue += parseMoney(item.totalPrice ?? item.total);
      productsMap.set(currentItem.id, currentItem);
    });
  });

  const topProducts = Array.from(productsMap.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);

  const openChanges = operations.changeRecords.filter((record) => record.status !== 'Retornou').length;
  const openAdvances = operations.advanceRecords.filter((record) => record.status !== 'Baixado').length;
  const openOccurrences = operations.occurrenceRecords.filter((record) => record.status !== 'Resolvida' && record.status !== 'Fechada').length;
  const uncheckedMachines = operations.machineChecklist.filter((record) => record.status !== 'Presente').length;
  const scheduleBase = activeCouriers.length > 0 ? activeCouriers : operations.courierRecords;
  const isSingleDay = startDate === endDate;

  return {
    kpis: [
      {
        id: 'orders',
        label: isSingleDay ? 'Pedidos hoje' : 'Pedidos no periodo',
        value: formatInteger(ordersInPeriod.length),
        meta: `${formatInteger(delayedOrders.length)} atrasados na leitura operacional`,
        badgeText: delayedOrders.length > 0 ? 'atraso' : 'ok',
        badgeClass: delayedOrders.length > 0 ? 'ui-badge--warning' : 'ui-badge--success',
        tone: 'amber',
      },
      {
        id: 'sales',
        label: isSingleDay ? 'Vendas hoje' : 'Vendas no periodo',
        value: formatInteger(totalSalesCount),
        meta: `${formatCurrency(totalSold)} vendidos no recorte ativo`,
        badgeText: 'comercial',
        badgeClass: 'ui-badge--info',
        tone: 'blue',
      },
      {
        id: 'revenue',
        label: isSingleDay ? 'Faturamento hoje' : 'Faturamento',
        value: formatCurrency(totalIncome || totalSold),
        meta: `${formatCurrency(totalExpense)} em saidas operacionais`,
        badgeText: 'financeiro',
        badgeClass: 'ui-badge--success',
        tone: 'cyan',
      },
      {
        id: 'ticket',
        label: 'Ticket medio',
        value: formatCurrency(averageTicket),
        meta: `${formatInteger(scheduleBase.length)} entregadores na base operacional`,
        badgeText: 'media',
        badgeClass: 'ui-badge--special',
        tone: 'blue',
      },
      {
        id: 'delayed',
        label: 'Pedidos atrasados',
        value: formatInteger(delayedOrders.length),
        meta: 'pedidos abertos acima do limite operacional',
        badgeText: delayedOrders.length > 0 ? 'acao' : 'estavel',
        badgeClass: delayedOrders.length > 0 ? 'ui-badge--danger' : 'ui-badge--success',
        tone: getToneByValue(delayedOrders.length),
      },
      {
        id: 'couriers',
        label: 'Entregadores ativos',
        value: formatInteger(activeCouriers.length),
        meta: `${formatInteger(scheduleBase.length)} nomes disponiveis na operacao`,
        badgeText: 'escala',
        badgeClass: 'ui-badge--info',
        tone: 'cyan',
      },
      {
        id: 'top-products',
        label: 'Top produtos',
        value: topProducts[0] ? formatInteger(topProducts[0].quantity) : '0',
        meta: topProducts[0]
          ? `${summarizeProductName(topProducts[0].name)} lidera o periodo`
          : 'aguardando vendas concluidas',
        badgeText: 'mix',
        badgeClass: 'ui-badge--special',
        tone: 'amber',
      },
      {
        id: 'low-stock',
        label: 'Estoque baixo',
        value: formatInteger(lowStockItems.length),
        meta: 'produtos no limite minimo ou abaixo dele',
        badgeText: lowStockItems.length > 0 ? 'alerta' : 'ok',
        badgeClass: lowStockItems.length > 0 ? 'ui-badge--danger' : 'ui-badge--success',
        tone: lowStockItems.length > 0 ? 'red' : 'cyan',
      },
    ],
    charts: {
      primary: {
        title: 'Faturamento por dia',
        description: 'Leitura diaria do valor vendido no periodo filtrado.',
        kind: 'trend',
        data: buildDailySalesSeries(completedSales, startDate, endDate),
      },
      secondary: {
        title: 'Pedidos por hora',
        description: 'Volume de pedidos por faixa horaria no recorte atual.',
        kind: 'bar',
        data: buildHourlyOrdersSeries(ordersInPeriod, completedSales),
      },
    },
    operations: {
      activeShift: activeCouriers.slice(0, 5).map((record) => ({
        id: record.id,
        name: record.courier,
        role: record.window ?? 'Janela nao informada',
        machine: record.machine ?? 'Sem maquininha',
        statusLabel: record.status ?? 'Confirmado',
        statusClass: getStatusBadgeClass(record.status),
      })),
      topProducts: topProducts.map((item) => ({
        id: item.id,
        title: item.name,
        description: `${formatInteger(item.quantity)} itens · ${formatCurrency(item.revenue)}`,
        badgeText: formatInteger(item.quantity),
        badgeClass: 'ui-badge--info',
      })),
      lowStock: lowStockItems.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.productName ?? 'Produto',
        description: `${formatInteger(item.currentStock)} em estoque · minimo ${formatInteger(item.minimumStock)}`,
        badgeText: 'estoque',
        badgeClass: 'ui-badge--danger',
      })),
      closing: [
        { id: 'income', label: 'Entradas', value: formatCurrency(totalIncome || totalSold) },
        { id: 'expense', label: 'Saidas', value: formatCurrency(totalExpense) },
        { id: 'balance', label: 'Saldo', value: formatCurrency((totalIncome || totalSold) - totalExpense) },
        { id: 'pending', label: 'Pendencias', value: formatInteger(openChanges + openAdvances + openOccurrences + uncheckedMachines) },
      ],
    },
  };
}
