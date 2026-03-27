function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function createGroups(products, getKey) {
  const groups = new Map()

  products.forEach((product) => {
    const key = getKey(product)

    if (!key) {
      return
    }

    const currentGroup = groups.get(key) ?? []
    currentGroup.push(product)
    groups.set(key, currentGroup)
  })

  return Array.from(groups.values()).filter((group) => group.length > 1)
}

export function analyzeProductCatalog(products) {
  const possibleEncodingIssues = products.filter((product) =>
    /�|Ã|PROMO��O/i.test(product.name ?? ''),
  )
  const zeroMinimumStock = products.filter(
    (product) => Number(product.stock ?? 0) > 0 && Number(product.minimumStock ?? 0) <= 0,
  )
  const uncategorized = products.filter((product) => !String(product.category ?? '').trim())
  const duplicateSkuGroups = createGroups(products, (product) => normalizeToken(product.sku))
  const duplicateNameGroups = createGroups(products, (product) => normalizeToken(product.name))

  return {
    possibleEncodingIssues,
    zeroMinimumStock,
    uncategorized,
    duplicateSkuGroups,
    duplicateNameGroups,
  }
}
