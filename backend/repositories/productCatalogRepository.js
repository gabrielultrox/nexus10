import { getAdminFirestore } from '../firebaseAdmin.js'
import { backendEnv } from '../config/env.js'
import { buildCacheKey, createCachedMethod } from '../cache/cacheService.js'
import { createLoggerContext } from '../logging/logger.js'

const productCatalogLogger = createLoggerContext({ module: 'repositories.product_catalog' })

function mapDoc(documentSnapshot) {
  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }
}

async function fetchProducts({ storeId, limit = 40 }) {
  const snapshot = await getAdminFirestore()
    .collection('stores')
    .doc(storeId)
    .collection('products')
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get()

  return snapshot.docs.map(mapDoc)
}

const cachedFetchProducts = createCachedMethod(
  {
    keyPrefix: 'store-products',
    ttlSeconds: backendEnv.redisProductTtlSeconds,
    keyBuilder: ({ storeId, limit = 40 }) => [storeId, limit],
    logger: productCatalogLogger,
  },
  fetchProducts,
)

export async function listStoreProducts({ storeId, limit = 40 }) {
  return cachedFetchProducts({ storeId, limit })
}

export function buildProductSearchCacheKey(storeId, limit = 40) {
  return buildCacheKey('store-products', storeId, limit)
}
