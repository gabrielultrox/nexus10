import { getAdminFirestore } from '../../firebaseAdmin.js'
import { listStoreProducts } from '../../repositories/productCatalogRepository.js'

const COLLECTIONS = {
  stores: 'stores',
  orders: 'orders',
  sales: 'sales',
  customers: 'customers',
  products: 'products',
}

function getStoreDocument(storeId) {
  return getAdminFirestore().collection(COLLECTIONS.stores).doc(storeId)
}

function asDate(value) {
  if (!value) {
    return null
  }

  return typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function buildCurrencyLabel(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0))
}

function getTodayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function getCollectionDocuments(storeId, collectionName, limit = 40) {
  if (collectionName === COLLECTIONS.products) {
    return listStoreProducts({ storeId, limit })
  }

  const snapshot = await getStoreDocument(storeId).collection(collectionName).limit(limit).get()
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  }))
}

function filterBySearch(records, text, projector) {
  const searchText = normalizeText(text)

  if (!searchText) {
    return records
  }

  return records.filter((record) => normalizeText(projector(record)).includes(searchText))
}

function extractSearchTerm(text, removableTokens = []) {
  return removableTokens
    .reduce(
      (currentText, token) => currentText.replace(token, ' '),
      text
        .replace(/\b(mostrar|buscar|procurar|listar|abrir|ir para|de hoje|dos|das)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function isGenericSearchTerm(value) {
  return [
    '',
    'pedido',
    'pedidos',
    'venda',
    'vendas',
    'cliente',
    'clientes',
    'produto',
    'produtos',
  ].includes(normalizeText(value))
}

function buildFilteredRecords(records, text, projector, removableTokens = []) {
  const searchTerm = extractSearchTerm(text, removableTokens)

  if (isGenericSearchTerm(searchTerm)) {
    return records
  }

  return filterBySearch(records, searchTerm, projector)
}

function buildOrderProjector(record) {
  return [record.code, record.customerSnapshot?.name, record.source, record.notes].join(' ')
}

function buildSaleProjector(record) {
  return [record.code, record.customerSnapshot?.name, record.channel, record.source].join(' ')
}

function buildCustomerProjector(record) {
  return [record.name, record.phone, record.neighborhood].join(' ')
}

function buildProductProjector(record) {
  return [record.name, record.category, record.sku].join(' ')
}

function buildOrderCards(records) {
  return records.map((order) => ({
    id: order.id,
    type: 'order',
    title: order.code ?? `Pedido ${order.id.slice(0, 6).toUpperCase()}`,
    subtitle: order.customerSnapshot?.name ?? 'Cliente não informado',
    meta: `${order.source ?? 'Canal não informado'} · ${buildCurrencyLabel(order.totals?.total ?? 0)}`,
    route: `/orders/${order.id}`,
  }))
}

function buildSaleCards(records) {
  return records.map((sale) => ({
    id: sale.id,
    type: 'sale',
    title: sale.code ?? `Venda ${sale.id.slice(0, 6).toUpperCase()}`,
    subtitle: sale.customerSnapshot?.name ?? 'Cliente avulso',
    meta: `${sale.channel ?? 'Canal não informado'} · ${buildCurrencyLabel(sale.totals?.total ?? sale.total ?? 0)}`,
    route: `/sales/${sale.id}`,
  }))
}

function buildCustomerCards(records) {
  return records.map((customer) => ({
    id: customer.id,
    type: 'customer',
    title: customer.name ?? 'Cliente',
    subtitle: customer.phone ?? 'Sem telefone',
    meta: customer.neighborhood ?? 'Sem bairro informado',
    route: '/customers',
  }))
}

function buildProductCards(records) {
  return records.map((product) => ({
    id: product.id,
    type: 'product',
    title: product.name ?? 'Produto',
    subtitle: product.category ?? 'Sem categoria',
    meta: buildCurrencyLabel(product.price ?? 0),
    route: '/products',
  }))
}

export function createAssistantQueryService() {
  return {
    async searchOrders({ storeId, text }) {
      const records = await getCollectionDocuments(storeId, COLLECTIONS.orders)
      const filtered = buildFilteredRecords(records, text, buildOrderProjector, [
        /\bpedido[s]?\b/gi,
      ])

      return buildOrderCards(filtered.slice(0, 6))
    },

    async searchSales({ storeId, text }) {
      const records = await getCollectionDocuments(storeId, COLLECTIONS.sales)
      const normalizedText = normalizeText(text)
      const todayRange = getTodayRange()
      let filtered = records

      if (normalizedText.includes('hoje')) {
        filtered = filtered.filter((record) => {
          const createdAt = asDate(record.createdAt)
          return createdAt && createdAt >= todayRange.start && createdAt <= todayRange.end
        })
      }

      filtered = buildFilteredRecords(filtered, text, buildSaleProjector, [/\bvenda[s]?\b/gi])

      return buildSaleCards(filtered.slice(0, 6))
    },

    async searchCustomers({ storeId, text }) {
      const records = await getCollectionDocuments(storeId, COLLECTIONS.customers)
      const filtered = buildFilteredRecords(records, text, buildCustomerProjector, [
        /\bcliente[s]?\b/gi,
      ])

      return buildCustomerCards(filtered.slice(0, 6))
    },

    async searchProducts({ storeId, text }) {
      const records = await getCollectionDocuments(storeId, COLLECTIONS.products)
      const filtered = buildFilteredRecords(records, text, buildProductProjector, [
        /\bproduto[s]?\b/gi,
      ])

      return buildProductCards(filtered.slice(0, 6))
    },
  }
}
