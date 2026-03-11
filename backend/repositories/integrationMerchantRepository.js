import { getAdminFirestore } from '../firebaseAdmin.js';

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
  const snapshot = await getMerchantCollection(storeId).doc(merchantId).get();

  if (!snapshot.exists) {
    return null;
  }

  const merchant = mapDoc(snapshot);
  return merchant.source === source ? merchant : null;
}

export async function listIntegrationMerchants({ storeId, source = 'ifood', enabledOnly = false }) {
  const snapshot = await getMerchantCollection(storeId)
    .where('source', '==', source)
    .get();

  return snapshot.docs
    .map(mapDoc)
    .filter((merchant) => !enabledOnly || merchant.status === 'active');
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
}
