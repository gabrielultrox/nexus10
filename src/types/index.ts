export type TimestampValue = string | Date | { toDate(): Date }

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
  COURIER = 'COURIER',
}

export interface IUser {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface ILoginRequest {
  pin: string
  deviceId?: string
}

export interface IRequestError {
  message: string
  code?: string
  details?: unknown
}

export interface IAuthContext {
  user: IUser | null
  isAuthenticated: boolean
  loading: boolean
  error: IRequestError | null
  login: (payload: ILoginRequest) => Promise<IUser>
  logout: () => Promise<void>
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  PIX = 'PIX',
}

export interface IOrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  notes?: string
}

export interface IOrder {
  id: string
  customerId: string
  items: IOrderItem[]
  status: OrderStatus
  total: number
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface ICreateOrderRequest {
  customerId: string
  items: Omit<IOrderItem, 'id'>[]
  paymentMethod: PaymentMethod
  notes?: string
}

export interface IProduct {
  id: string
  name: string
  description?: string
  price: number
  cost?: number
  category: string
  stock: number
  sku: string
  active: boolean
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface ICustomer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  cpf?: string
  notes?: string
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export interface IApiResponse<T> {
  success: boolean
  data?: T
  error?: IRequestError
  timestamp: string
}

export interface IPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export * from './api'
export * from './components'
export * from './domain'
