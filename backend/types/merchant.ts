export type IntegrationSource = 'ifood';

export interface IfoodMerchant {
  id?: string;
  merchantId: string;
  tenantId: string | null;
  source: IntegrationSource;
  name?: string;
  status?: 'active' | 'inactive' | 'pending' | string;
  clientId?: string;
  clientSecret?: string;
  storeId?: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastPollingAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}
