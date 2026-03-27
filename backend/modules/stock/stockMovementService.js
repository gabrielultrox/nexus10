import { getAdminFirestore } from '../../firebaseAdmin.js'
import { createStockMovementRepository } from './stockMovementRepository.js'
import { createStockRepository } from './stockRepository.js'

const decrementTypes = new Set(['sale', 'manual_out'])
const incrementTypes = new Set(['manual_in', 'sale_reversal'])

const stockRepository = createStockRepository()
const stockMovementRepository = createStockMovementRepository()

function resolveNextStock(currentStock, movementType, quantity) {
  if (movementType === 'manual_set' || movementType === 'csv_import') {
    return quantity
  }

  if (decrementTypes.has(movementType)) {
    return currentStock - quantity
  }

  if (incrementTypes.has(movementType)) {
    return currentStock + quantity
  }

  throw new Error('Tipo de movimentacao de estoque invalido.')
}

function buildProductSnapshot(productId, product, fallbackData = {}) {
  return {
    productId,
    productName: product?.name ?? fallbackData.productName ?? 'Produto',
    category: product?.category ?? fallbackData.category ?? '',
    sku: product?.sku ?? fallbackData.sku ?? '',
    minimumStock: Number(product?.minimumStock ?? fallbackData.minimumStock ?? 0),
    currentStock: Number(product?.stock ?? fallbackData.currentStock ?? 0),
    status: product?.status ?? fallbackData.status ?? 'active',
  }
}

export async function applyStockMovement({
  storeId,
  tenantId = null,
  productId,
  movementType,
  quantity,
  reason,
  source = 'manual',
  relatedSaleId = null,
  movementId = null,
  productSnapshot = null,
  minimumStockOverride = null,
}) {
  const firestore = getAdminFirestore()
  const stockItemRef = stockRepository.getStockItemRef(storeId, productId)
  const legacyStockItemRef = stockRepository.getLegacyStockItemRef(storeId, productId)
  const productRef = stockRepository.getProductRef(storeId, productId)
  const movementRef = stockMovementRepository.createMovementRef(storeId, movementId)
  const legacyMovementRef = stockMovementRepository.createLegacyMovementRef(
    storeId,
    movementId ?? movementRef.id,
  )

  await firestore.runTransaction(async (transaction) => {
    const [
      stockItemSnapshot,
      legacyStockItemSnapshot,
      productSnapshotDoc,
      movementSnapshot,
      legacyMovementSnapshot,
    ] = await Promise.all([
      transaction.get(stockItemRef),
      transaction.get(legacyStockItemRef),
      transaction.get(productRef),
      transaction.get(movementRef),
      transaction.get(legacyMovementRef),
    ])

    if (movementSnapshot.exists || legacyMovementSnapshot.exists) {
      return
    }

    const productData = productSnapshotDoc.exists ? productSnapshotDoc.data() : null
    const currentStockSource = stockItemSnapshot.exists
      ? stockItemSnapshot.data()
      : legacyStockItemSnapshot.data()
    const snapshot = buildProductSnapshot(
      productId,
      {
        ...(productData ?? {}),
        ...(productSnapshot ?? {}),
      },
      currentStockSource,
    )
    const currentStock = Number(currentStockSource?.currentStock ?? snapshot.currentStock ?? 0)
    const minimumStock =
      minimumStockOverride != null
        ? Number(minimumStockOverride)
        : Number(currentStockSource?.minimumStock ?? snapshot.minimumStock ?? 0)
    const nextStock = resolveNextStock(currentStock, movementType, Number(quantity ?? 0))
    const nextStockPayload = {
      storeId,
      tenantId,
      productId,
      productName: snapshot.productName,
      category: snapshot.category,
      sku: snapshot.sku,
      currentStock: nextStock,
      minimumStock,
      status: snapshot.status,
      lowStock: nextStock <= minimumStock,
      createdAt: currentStockSource?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    const movementPayload = {
      storeId,
      tenantId,
      productId,
      productName: snapshot.productName,
      category: snapshot.category,
      sku: snapshot.sku,
      movementType,
      quantity: Number(quantity ?? 0),
      reason,
      source,
      relatedSaleId,
      previousStock: currentStock,
      resultingStock: nextStock,
      createdAt: new Date(),
    }

    if (nextStock < 0) {
      throw new Error(`Estoque insuficiente para ${snapshot.productName}.`)
    }

    transaction.set(stockItemRef, nextStockPayload, { merge: true })
    transaction.set(legacyStockItemRef, nextStockPayload, { merge: true })

    if (productSnapshotDoc.exists) {
      transaction.set(
        productRef,
        {
          stock: nextStock,
          minimumStock,
          updatedAt: new Date(),
        },
        { merge: true },
      )
    }

    transaction.set(movementRef, movementPayload)
    transaction.set(legacyMovementRef, movementPayload)
  })

  return movementRef.id
}
