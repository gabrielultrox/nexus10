export const queryKeys = {
  orders: {
    all: (storeId) => ['orders', storeId],
    list: (storeId, options = {}) => ['orders', storeId, 'list', options],
    detail: (storeId, orderId) => ['orders', storeId, 'detail', orderId],
  },
  sales: {
    all: (storeId) => ['sales', storeId],
    list: (storeId, options = {}) => ['sales', storeId, 'list', options],
    detail: (storeId, saleId) => ['sales', storeId, 'detail', saleId],
  },
  finance: {
    all: (storeId) => ['finance', storeId],
    entries: (storeId, options = {}) => ['finance', storeId, 'entries', options],
    closures: (storeId, options = {}) => ['finance', storeId, 'closures', options],
  },
}
