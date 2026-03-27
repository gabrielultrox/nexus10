# Firestore query and pagination pattern

## Objective

Avoid full collection scans in high-traffic lists and keep pagination stable without offset-based reads.

## Standard pattern

Use:

1. `orderBy()` on a deterministic indexed field
2. `orderBy(documentId())` as a tiebreaker
3. `startAfter(cursor.value, cursor.id)` for the next page
4. `limit(pageSize)` to cap reads

The shared implementation lives in:

- [src/services/firestore.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\firestore.js)

## Example

```js
const page = await getPaginatedStoreCollectionDocuments(storeId, FIRESTORE_COLLECTIONS.orders, {
  orderField: 'createdAt',
  orderDirection: 'desc',
  pageSize: 50,
  cursor,
  cacheKey: buildStoreQueryCacheKey(storeId, FIRESTORE_COLLECTIONS.orders, 'page-by-createdAt'),
});
```

Returned shape:

```js
{
  items: [...],
  nextCursor: {
    id: 'document-id',
    orderField: 'createdAt',
    value: Date
  },
  hasMore: true
}
```

## Where it is applied

- Orders page API helper:
  - [src/services/orders.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\orders.js)
- Sales page API helper:
  - [src/services/sales.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\sales.js)
- Products page API helper:
  - [src/services/productService.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\productService.js)

## Cache policy

- Query pages use short-lived in-memory cache
- Mutations invalidate the corresponding list prefix
- Redis remains the backend cache layer for assistant and store metadata

Use cache when:

- the same first page is reopened often
- the list is operator-facing and not financial/audit critical

Avoid cache when:

- the screen is an audit trail that must reflect every write immediately
- the result depends on rapidly changing server-side permissions

## Batch reads

When a screen already has document ids, use `getStoreDocumentsByIds()` instead of `getDoc()` in a loop.

This helper:

- chunks ids by 10
- uses `where(documentId(), 'in', chunk)`
- reduces round trips and avoids N+1 fetches

Current helper:

- [src/services/firestore.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\firestore.js)

Applied example:

- [src/services/productService.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\services\productService.js)

## Indexing rule of thumb

Add a composite index whenever a query combines:

- one or more `where(...)`
- one explicit `orderBy(...)`

The current optimized composite indexes are declared in:

- [firestore.indexes.json](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\firestore.indexes.json)
