import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { subscribeToFinancialEntries } from './finance';
import { assertFirebaseReady, firebaseDb } from './firebase';
import { FIRESTORE_COLLECTIONS } from './firestoreCollections';
import { subscribeToProducts } from './productService';
import { subscribeToSales } from './sales';

function asDate(value) {
  if (!value) {
    return null;
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
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

function formatDayKey(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(asDate(value));
}

function formatDateKey(value) {
  const dateValue = asDate(value);

  if (!dateValue) {
    return '';
  }

  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseMoney(value) {
  return Number(value ?? 0);
}

export function subscribeToReportSources(storeId, handlers) {
  const unsubscribers = [];

  unsubscribers.push(subscribeToSales(storeId, handlers.onSales, handlers.onError));
  unsubscribers.push(subscribeToFinancialEntries(storeId, handlers.onFinancialEntries, handlers.onError));
  unsubscribers.push(subscribeToProducts(storeId, handlers.onProducts, handlers.onError));

  assertFirebaseReady();
  const ordersQuery = query(
    collection(firebaseDb, FIRESTORE_COLLECTIONS.stores, storeId, FIRESTORE_COLLECTIONS.orders),
    orderBy('createdAt', 'desc'),
  );

  unsubscribers.push(onSnapshot(
    ordersQuery,
    (snapshot) => {
      handlers.onOrders(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    },
    handlers.onError,
  ));

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  };
}

export function buildPdvReportData({
  sales,
  orders,
  products,
  financialEntries,
  startDate,
  endDate,
}) {
  const filteredSales = sales.filter((sale) => (
    sale.status === 'completed' && isWithinPeriod(sale.createdAt, startDate, endDate)
  ));
  const filteredOrders = orders.filter((order) => isWithinPeriod(order.createdAt, startDate, endDate));
  const filteredFinancialEntries = financialEntries.filter((entry) => isWithinPeriod(entry.createdAt, startDate, endDate));
  const productCostMap = new Map(products.map((product) => [product.id, parseMoney(product.cost)]));

  const totalSold = filteredSales.reduce((total, sale) => total + parseMoney(sale.total), 0);
  const salesCount = filteredSales.length;
  const averageTicket = salesCount > 0 ? totalSold / salesCount : 0;

  const topProductsMap = new Map();
  let estimatedProfit = 0;

  filteredSales.forEach((sale) => {
    sale.items?.forEach((item) => {
      const key = item.productId || item.name;
      const existing = topProductsMap.get(key) ?? {
        id: key,
        label: item.name,
        quantity: 0,
        revenue: 0,
      };

      existing.quantity += Number(item.quantity ?? 0);
      existing.revenue += parseMoney(item.total);
      topProductsMap.set(key, existing);

      const itemCost = productCostMap.get(item.productId) ?? null;
      if (itemCost != null) {
        estimatedProfit += (parseMoney(item.unitPrice) - itemCost) * Number(item.quantity ?? 0);
      }
    });
  });

  const topProducts = Array.from(topProductsMap.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 6);

  const paymentMethodMap = filteredSales.reduce((accumulator, sale) => {
    const key = sale.paymentMethod || 'Nao informado';
    const bucket = accumulator.get(key) ?? {
      id: key,
      label: key,
      count: 0,
      total: 0,
    };

    bucket.count += 1;
    bucket.total += parseMoney(sale.total);
    accumulator.set(key, bucket);
    return accumulator;
  }, new Map());

  const paymentMethods = Array.from(paymentMethodMap.values())
    .sort((left, right) => right.total - left.total);

  const orderStatusSource = filteredOrders.length > 0
    ? filteredOrders.map((order) => order.status || 'Sem status')
    : filteredSales
      .map((sale) => sale.orderSnapshot?.status)
      .filter(Boolean);

  const orderStatusMap = orderStatusSource.reduce((accumulator, status) => {
    accumulator.set(status, (accumulator.get(status) ?? 0) + 1);
    return accumulator;
  }, new Map());

  const orderStatuses = Array.from(orderStatusMap.entries()).map(([label, value]) => ({
    id: label,
    label,
    value,
  }));

  const salesByDayMap = filteredSales.reduce((accumulator, sale) => {
    const dayKey = formatDayKey(sale.createdAt);
    const bucket = accumulator.get(dayKey) ?? {
      id: dayKey,
      label: dayKey,
      dateKey: formatDateKey(sale.createdAt),
      total: 0,
      count: 0,
    };

    bucket.total += parseMoney(sale.total);
    bucket.count += 1;
    accumulator.set(dayKey, bucket);
    return accumulator;
  }, new Map());

  const salesByDay = Array.from(salesByDayMap.values())
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));

  const activeFinancialSales = filteredFinancialEntries.filter(
    (entry) => entry.source === 'venda' && entry.status === 'ativa',
  );

  return {
    totals: {
      totalSold,
      averageTicket,
      salesCount,
      estimatedProfit,
      activeFinancialSales: activeFinancialSales.reduce((total, entry) => total + parseMoney(entry.amount), 0),
    },
    topProducts,
    paymentMethods,
    orderStatuses,
    salesByDay,
    exportRows: filteredSales.map((sale) => ({
      saleId: sale.id,
      orderId: sale.orderId ?? '',
      customer: sale.customerSnapshot?.name ?? '',
      paymentMethod: sale.paymentMethod ?? '',
      total: parseMoney(sale.total).toFixed(2),
      status: sale.status ?? '',
      createdAt: asDate(sale.createdAt)?.toISOString() ?? '',
    })),
  };
}

export function buildPdvReportCsv(reportData) {
  const columns = [
    { header: 'sale_id', key: 'saleId' },
    { header: 'order_id', key: 'orderId' },
    { header: 'customer', key: 'customer' },
    { header: 'payment_method', key: 'paymentMethod' },
    { header: 'total', key: 'total' },
    { header: 'status', key: 'status' },
    { header: 'created_at', key: 'createdAt' },
  ];
  const rows = reportData.exportRows.map((row) => columns.map((column) => row[column.key] ?? ''));
  const header = columns.map((column) => column.header);
  const csvLines = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  return csvLines.join('\n');
}
