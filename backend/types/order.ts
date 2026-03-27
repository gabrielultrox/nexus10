export interface OrderItem {
  id?: string
  productId: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  productSnapshot?: {
    id?: string | null
    name: string
    category?: string
    sku?: string
  }
}

export interface OrderTotals {
  subtotal: number
  freight: number
  extraAmount: number
  discountPercent: number
  discountValue: number
  total: number
}

export interface OrderRecord {
  id: string
  code?: string
  source?: string
  status?: string
  saleStatus?: string
  storeId?: string
  tenantId?: string | null
  customerId?: string | null
  orderId?: string
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  items: OrderItem[]
  totals: OrderTotals
}
