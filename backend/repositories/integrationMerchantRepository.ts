import type {
  CollectionReference,
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'

import { buildCacheKey, cacheInvalidate, cacheRemember } from '../cache/cacheService.js'
import { backendEnv } from '../config/env.js'
import { getAdminFirestore } from '../firebaseAdmin.js'
import type {
  IntegrationMerchantListOptions,
  IntegrationMerchantLookupOptions,
  IntegrationMerchantTouchOptions,
  MerchantRecord,
} from '../types/index.js'

const COLLECTIONS = {
  stores: 'stores',
  integrationMerchants: 'integration_merchants',
} as const

function mapDoc(
  documentSnapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): MerchantRecord {
  return {
    id: documentSnapshot.id,
    ...(documentSnapshot.data() ?? {}),
  } as MerchantRecord
}

function getMerchantCollection(storeId: string): CollectionReference<DocumentData> {
  return getAdminFirestore()
    .collection(COLLECTIONS.stores)
    .doc(storeId)
    .collection(COLLECTIONS.integrationMerchants)
}

export async function getIntegrationMerchant({
  storeId,
  merchantId,
  source = 'ifood',
}: IntegrationMerchantLookupOptions): Promise<MerchantRecord | null> {
  const cacheKey = buildCacheKey('store', storeId, 'merchant', merchantId, source)

  return (await cacheRemember({
    key: cacheKey,
    ttlSeconds: backendEnv.redisMerchantTtlSeconds,
    loader: async () => {
      const snapshot = await getMerchantCollection(storeId).doc(merchantId).get()

      if (!snapshot.exists) {
        return null
      }

      const merchant = mapDoc(snapshot)
      return merchant.source === source ? merchant : null
    },
  })) as MerchantRecord | null
}

export async function listIntegrationMerchants({
  storeId,
  source = 'ifood',
  enabledOnly = false,
}: IntegrationMerchantListOptions): Promise<MerchantRecord[]> {
  const cacheKey = buildCacheKey(
    'store',
    storeId,
    'merchants',
    source,
    enabledOnly ? 'active' : 'all',
  )

  return (await cacheRemember({
    key: cacheKey,
    ttlSeconds: backendEnv.redisMerchantTtlSeconds,
    loader: async () => {
      const snapshot = await getMerchantCollection(storeId)
        .where('source', '==', source)
        .orderBy('updatedAt', 'desc')
        .limit(enabledOnly ? 100 : 200)
        .get()

      return snapshot.docs
        .map(mapDoc)
        .filter((merchant) => !enabledOnly || merchant.status === 'active')
    },
  })) as MerchantRecord[]
}

export async function touchIntegrationMerchant({
  storeId,
  merchantId,
  updates,
}: IntegrationMerchantTouchOptions): Promise<void> {
  await getMerchantCollection(storeId)
    .doc(merchantId)
    .set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )

  await cacheInvalidate([
    buildCacheKey('store', storeId, 'merchant', merchantId, 'ifood'),
    buildCacheKey('store', storeId, 'merchants', 'ifood', 'all'),
    buildCacheKey('store', storeId, 'merchants', 'ifood', 'active'),
  ])
}
