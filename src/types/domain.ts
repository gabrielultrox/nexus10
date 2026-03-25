import type { PaymentMethod, TimestampValue } from './index'

export interface IDashboardMetrics {
  totalOrders: number
  totalRevenue: number
  totalCustomers: number
  ordersToday: number
  averageOrderValue: number
  lastUpdated: TimestampValue
}

export interface IFinanceReport {
  date: string
  income: number
  expenses: number
  profit: number
  paymentMethods: Partial<Record<PaymentMethod, number>>
}

export enum InventoryMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export interface IInventoryMovement {
  id: string
  productId: string
  type: InventoryMovementType
  quantity: number
  reason: string
  userId: string
  createdAt: TimestampValue
}

export interface IAuditLog {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string
  changes: Record<string, unknown>
  timestamp: TimestampValue
  ipAddress?: string
}

export interface ICacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
  version: string
}

export enum OfflineQueueAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface IOfflineQueueItem {
  id: string
  action: OfflineQueueAction
  entity: string
  data: Record<string, unknown>
  timestamp: number
  version: string
  retries: number
}
