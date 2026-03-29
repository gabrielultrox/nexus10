export type RuntimeEnvironment = 'development' | 'staging' | 'production' | 'test'
export type IntegrationSource = 'ifood'
export type UserRole = 'admin' | 'gerente' | 'operador' | 'atendente'
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'sent'
  | 'delivered'
  | 'cancelled'
  | string
export type FinancialEntryType =
  | 'income'
  | 'expense'
  | 'adjustment'
  | 'refund'
  | 'chargeback'
  | string
export type ReportFormat = 'pdf' | 'excel'
export type ReportType = 'sales' | 'cash' | 'deliveries' | 'operations' | 'audit'

export interface UserIdentity {
  uid: string
  email: string | null
  displayName: string | null
}

export interface TenantScopedResource {
  tenantId: string | null
  storeId?: string
}

export interface StoreScopedResource {
  storeId: string
  tenantId?: string | null
}

export interface UserProfile extends UserIdentity {
  operatorName: string | null
  role: UserRole | string
  storeIds: string[]
  defaultStoreId: string | null
  status?: string
  authMode?: string
}

export interface AuthSessionClaims {
  role: UserRole
  tenantId: string | null
  storeIds: string[]
  defaultStoreId: string | null
  operatorName: string
  displayName: string
}

export interface LocalOperatorProfile extends UserProfile {
  operatorName: string
  displayName: string
  role: UserRole
  tenantId: string | null
  storeIds: string[]
  defaultStoreId: string | null
  status: string
  authMode: string
}

export interface AuthenticatedUserContext extends UserIdentity {
  operatorName: string | null
  role: UserRole | string
  tenantId: string | null
  storeIds: string[]
  defaultStoreId: string | null
  isAnonymous: boolean
  claims: Record<string, unknown>
}

export interface AuthSessionRequestBody {
  pin: string
  operator: string
  storeId: string | null
}

export interface AuthTokenSessionRequestBody {
  token: string
}

export interface AuthSessionResponseBody {
  data: {
    customToken: string
    profile: LocalOperatorProfile
  }
}

export interface AuthTokenSessionResponseBody {
  data: {
    session: {
      uid: string
      role: string
      tenantId: string | null
      storeIds: string[]
      defaultStoreId: string | null
      operatorName: string | null
      displayName: string | null
      email: string | null
    }
  }
}

export interface ApiErrorResponseBody {
  error: string
  code?: string
  details?: unknown
}

export interface ApiSuccessResponseBody<TData> {
  data: TData
  ok?: boolean
}

export interface RepositoryEntity {
  id: string
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

export interface ProductSnapshot {
  id?: string | null
  name: string
  category?: string
  sku?: string
}

export interface OrderItem {
  id?: string
  productId: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  productSnapshot?: ProductSnapshot
  notes?: string
}

export interface OrderTotals {
  subtotal: number
  freight: number
  extraAmount: number
  discountPercent: number
  discountValue: number
  total: number
}

export interface OrderRecord extends RepositoryEntity, TenantScopedResource {
  id: string
  code?: string
  source?: string
  status?: OrderStatus
  saleStatus?: string
  customerId?: string | null
  orderId?: string
  items: OrderItem[]
  totals: OrderTotals
}

export interface MerchantCredentials {
  clientId?: string
  clientSecret?: string
}

export interface MerchantStatusMetadata {
  status?: 'active' | 'inactive' | 'pending' | string
  lastPollingAt?: string | null
  lastSyncAt?: string | null
  lastSyncError?: string | null
}

export interface MerchantRecord
  extends Partial<RepositoryEntity>,
    Partial<StoreScopedResource>,
    MerchantCredentials,
    MerchantStatusMetadata {
  merchantId: string
  tenantId: string | null
  source: IntegrationSource
  name?: string
}

export interface FinancialEntry extends RepositoryEntity, StoreScopedResource {
  type: FinancialEntryType
  amount: number
  description: string
  date: string
  category?: string
  actorId?: string | null
  metadata?: Record<string, unknown>
}

export interface FinancialClosure extends RepositoryEntity, StoreScopedResource {
  entries: Array<Pick<FinancialEntry, 'id' | 'type' | 'amount' | 'description' | 'date'>>
  closedAt: string
  openedAt?: string
  closedBy?: string | null
  totalIncome?: number
  totalExpense?: number
  balance?: number
}

export interface PaginationCursor {
  id: string
  value: string | number | boolean | null
}

export interface PaginatedResult<TItem> {
  items: TItem[]
  nextCursor: PaginationCursor | null
  hasMore: boolean
}

export interface RepositoryListOptions<
  TFilters extends Record<string, unknown> = Record<string, unknown>,
> {
  limit?: number
  cursor?: PaginationCursor | null
  filters?: TFilters
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export interface RepositoryCreateOptions {
  actorId?: string | null
  requestId?: string
}

export interface RepositoryUpdateOptions extends RepositoryCreateOptions {
  merge?: boolean
}

export interface RepositoryDeleteOptions extends RepositoryCreateOptions {
  softDelete?: boolean
}

export interface Repository<
  TEntity extends RepositoryEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
> {
  getById(id: string): Promise<TEntity | null>
  list(options?: RepositoryListOptions<TFilters>): Promise<PaginatedResult<TEntity>>
  create(input: TCreateInput, options?: RepositoryCreateOptions): Promise<TEntity>
  update(id: string, input: TUpdateInput, options?: RepositoryUpdateOptions): Promise<TEntity>
  delete(id: string, options?: RepositoryDeleteOptions): Promise<void>
}

export interface CacheEnvelope<TValue> {
  key: string
  ttlSeconds: number
  value: TValue
}

export interface RequestLoggerLike {
  trace?: (payload: unknown, message?: string) => void
  debug?: (payload: unknown, message?: string) => void
  info: (payload: unknown, message?: string) => void
  warn: (payload: unknown, message?: string) => void
  error: (payload: unknown, message?: string) => void
  fatal?: (payload: unknown, message?: string) => void
  child?: (bindings: Record<string, unknown>) => RequestLoggerLike
}

export interface LoggerContext {
  request_id?: string
  method?: string
  route?: string
  ip_address?: string
  user_id?: string | null
  context?: string
  [key: string]: unknown
}

export interface RequestValidationPayload<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
> {
  body?: TBody
  params?: TParams
  query?: TQuery
}

export type ValidationSource = 'body' | 'params' | 'query' | 'webhook'

export interface ValidationMiddlewareOptions<TRequestSource = unknown> {
  source?: ValidationSource
  targetKey?: string
  mapRequest?: (request: any) => TRequestSource
}

export interface ValidationSourceConfigEntry<TRequestSource = unknown> {
  schema: unknown
  source?: ValidationSource
  mapRequest?: (request: any) => TRequestSource
}

export type ValidationSourceConfig =
  | ValidationSourceConfigEntry
  | {
      safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: unknown }
    }

export interface StoreRouteParams extends Record<string, string> {
  storeId: string
}

export interface OrderRouteParams extends StoreRouteParams {
  orderId: string
}

export interface SaleRouteParams extends StoreRouteParams {
  saleId: string
}

export interface FinanceRequestActor {
  uid: string | null
}

export interface ControllerErrorLike {
  message?: string
  statusCode?: number
}

export interface IntegrationMerchantLookupOptions {
  storeId: string
  merchantId: string
  source?: IntegrationSource | string
}

export interface IntegrationMerchantListOptions {
  storeId: string
  source?: IntegrationSource | string
  enabledOnly?: boolean
}

export interface IntegrationMerchantTouchOptions {
  storeId: string
  merchantId: string
  updates: Partial<MerchantRecord> & Record<string, unknown>
}

export interface FinanceRepository {
  getFinancialEntryRef(storeId: string, entryId: string): unknown
  getFinancialClosureRef(storeId: string, closureId: string): unknown
  getFinancialEntryById(storeId: string, entryId: string): Promise<Record<string, unknown> | null>
  upsertFinancialEntry(
    storeId: string,
    entryId: string,
    payload: Record<string, unknown>,
  ): Promise<string>
  upsertFinancialClosure(
    storeId: string,
    closureId: string,
    payload: Record<string, unknown>,
  ): Promise<string>
}

export interface TypedRequestContext<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
> {
  authUser?: AuthenticatedUserContext
  validated?: RequestValidationPayload<TBody, TParams, TQuery>
}

export interface BackendEnvironment {
  port: number
  nodeEnv: RuntimeEnvironment
  appEnv: RuntimeEnvironment
  trustProxy: boolean | number | string | string[]
  logLevel: Exclude<LogLevel, 'fatal'>
  sentryDsn: string
  sentryRelease: string
  sentryTracesSampleRate: number
  monitoringWindowMs: number
  alertCooldownMs: number
  alertDiscordWebhookUrl: string
  alertErrorRateThresholdPercent: number
  alertLatencyP95ThresholdMs: number
  alertIfoodWebhookFailureThreshold: number
  localOperatorPassword: string
  redisUrl: string
  redisKeyPrefix: string
  redisSocketTimeoutMs: number
  redisSessionTtlSeconds: number
  redisMerchantTtlSeconds: number
  redisProductTtlSeconds: number
  openaiApiKey: string | null
  frontendOrigin: string[]
  corsPreflightMaxAgeSeconds: number
  securityUserAgentBlocklist: string[]
  rateLimitTrustedIps: string[]
  apiRateLimitWindowMs: number
  apiRateLimitMax: number
  authRateLimitMax: number
  ifoodEnabled: boolean
  ifoodClientId: string
  ifoodClientSecret: string
  ifoodAuthBaseUrl: string
  ifoodMerchantBaseUrl: string
  ifoodEventsPollingPath: string
  ifoodEventsAckPath: string
  ifoodOrderDetailsPath: string
  ifoodWebhookUrl: string
  ifoodWebhookSecret: string
  ifoodPollingIntervalSeconds: number
  firebaseProjectId: string
  firebaseClientEmail: string
  firebasePrivateKey: string
  firebaseStorageBucket: string
  firestoreEmulatorHost: string
  firebaseAuthEmulatorHost: string
}
