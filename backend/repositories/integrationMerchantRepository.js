import { getAdminFirestore } from '../firebaseAdmin.js';
import { backendEnv } from '../config/env.js';
import { buildCacheKey, cacheInvalidate, cacheRemember } from '../cache/cacheService.js';

const COLLECTIONS = {
  stores: 'stores',
  integrationMerchants: 'integration_merchants',
};

function mapDoc(documentSnapshot) {
  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}

function getMerchantCollection(storeId) {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.integrationMerchants);
}

export async function getIntegrationMerchant({ storeId, merchantId, source = 'ifood' }) {
  const cacheKey = buildCacheKey('store', storeId, 'merchant', merchantId, source);

  return cacheRemember({
    key: cacheKey,
    ttlSeconds: backendEnv.redisMerchantTtlSeconds,
    loader: async () => {
      const snapshot = await getMerchantCollection(storeId).doc(merchantId).get();

      if (!snapshot.exists) {
        return null;
      }

      const merchant = mapDoc(snapshot);
      return merchant.source === source ? merchant : null;
    },
  });
}

export async function listIntegrationMerchants({ storeId, source = 'ifood', enabledOnly = false }) {
  const cacheKey = buildCacheKey('store', storeId, 'merchants', source, enabledOnly ? 'active' : 'all');

  return cacheRemember({
    key: cacheKey,
    ttlSeconds: backendEnv.redisMerchantTtlSeconds,
    loader: async () => {
      const snapshot = await getMerchantCollection(storeId)
        .where('source', '==', source)
        .orderBy('updatedAt', 'desc')
        .limit(enabledOnly ? 100 : 200)
        .get();

      return snapshot.docs
        .map(mapDoc)
        .filter((merchant) => !enabledOnly || merchant.status === 'active');
    },
  });
}

export async function touchIntegrationMerchant({
  storeId,
  merchantId,
  updates,
}) {
  await getMerchantCollection(storeId)
    .doc(merchantId)
    .set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  await cacheInvalidate([
    buildCacheKey('store', storeId, 'merchant', merchantId, 'ifood'),
    buildCacheKey('store', storeId, 'merchants', 'ifood', 'all'),
    buildCacheKey('store', storeId, 'merchants', 'ifood', 'active'),
  ]);
}
