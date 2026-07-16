export const storeDomainStatuses = [
  'pending_provisioning',
  'pending_ownership',
  'pending_dns',
  'pending_ssl',
  'ready',
  'active',
  'redirect',
  'failed',
  'removing',
  'removed',
] as const;

export type StoreDomainStatus = (typeof storeDomainStatuses)[number];
export type StoreDomainRole = 'primary' | 'redirect';

export type DomainDnsRecord = {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  purpose: 'routing' | 'ownership';
};

export type StoreDomain = {
  id: string;
  configurationId: string;
  storeId: string;
  hostname: string;
  apexHostname: string;
  preferredPrimary: 'www' | 'apex';
  role: StoreDomainRole;
  status: StoreDomainStatus;
  redirectToDomainId?: string;
  dnsRecords: DomainDnsRecord[];
  verificationRecords: DomainDnsRecord[];
  lastErrorCode?: string;
  attempts: number;
  nextCheckAt?: string;
  lastCheckedAt?: string;
  verifiedAt?: string;
  activatedAt?: string;
  removedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type DomainEventType =
  | 'domain_requested'
  | 'provider_provisioned'
  | 'status_checked'
  | 'domain_activated'
  | 'redirect_configured'
  | 'domain_removal_requested'
  | 'domain_removed'
  | 'operation_failed';

export type DomainActionResult = {
  ok: boolean;
  message: string;
  code?: string;
};
