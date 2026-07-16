import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import type {
  DomainEventType,
  StoreDomain,
  StoreDomainRole,
  StoreDomainStatus,
} from './domain.types';

type DomainRow = {
  id: string;
  configuration_id: string;
  store_id: string;
  hostname: string;
  apex_hostname: string;
  preferred_primary_variant: 'www' | 'apex';
  domain_role: StoreDomainRole;
  status: StoreDomainStatus;
  redirect_to_domain_id: string | null;
  dns_records: StoreDomain['dnsRecords'] | null;
  verification_records: StoreDomain['verificationRecords'] | null;
  last_error_code: string | null;
  attempts: number;
  next_check_at: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
  activated_at: string | null;
  removed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export class DomainRepositoryError extends Error {
  constructor(readonly code: 'storage_unavailable' | 'domain_taken' | 'not_found') {
    super(code);
    this.name = 'DomainRepositoryError';
  }
}

function adminClient() {
  const client = createOptionalAdminClient();

  if (!client) {
    throw new DomainRepositoryError('storage_unavailable');
  }

  return client;
}

function toDomain(row: DomainRow): StoreDomain {
  return {
    id: row.id,
    configurationId: row.configuration_id,
    storeId: row.store_id,
    hostname: row.hostname,
    apexHostname: row.apex_hostname,
    preferredPrimary: row.preferred_primary_variant,
    role: row.domain_role,
    status: row.status,
    redirectToDomainId: row.redirect_to_domain_id ?? undefined,
    dnsRecords: Array.isArray(row.dns_records) ? row.dns_records : [],
    verificationRecords: Array.isArray(row.verification_records)
      ? row.verification_records
      : [],
    lastErrorCode: row.last_error_code ?? undefined,
    attempts: row.attempts,
    nextCheckAt: row.next_check_at ?? undefined,
    lastCheckedAt: row.last_checked_at ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    activatedAt: row.activated_at ?? undefined,
    removedAt: row.removed_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStoreDomains(storeId: string) {
  const { data, error } = await adminClient()
    .from('store_domains')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw new DomainRepositoryError('storage_unavailable');
  return (data as DomainRow[]).map(toDomain);
}

export async function getStoreDomain(input: { domainId: string; storeId: string }) {
  const { data, error } = await adminClient()
    .from('store_domains')
    .select('*')
    .eq('id', input.domainId)
    .eq('store_id', input.storeId)
    .maybeSingle();

  if (error) throw new DomainRepositoryError('storage_unavailable');
  return data ? toDomain(data as DomainRow) : null;
}

export async function getStoreDomainByHostname(hostname: string) {
  const { data, error } = await adminClient()
    .from('store_domains')
    .select('*')
    .eq('hostname', hostname)
    .neq('status', 'removed')
    .maybeSingle();

  if (error) throw new DomainRepositoryError('storage_unavailable');
  return data ? toDomain(data as DomainRow) : null;
}

export async function getActivePrimaryStoreDomain(storeId: string) {
  const { data, error } = await adminClient()
    .from('store_domains')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .eq('domain_role', 'primary')
    .maybeSingle();

  if (error) throw new DomainRepositoryError('storage_unavailable');
  return data ? toDomain(data as DomainRow) : null;
}

export async function createStoreDomainRequest(input: {
  configurationId: string;
  storeId: string;
  hostname: string;
  apexHostname: string;
  preferredPrimary: 'www' | 'apex';
  role: StoreDomainRole;
  createdBy: string;
}) {
  const client = adminClient();
  const payload = {
    configuration_id: input.configurationId,
    store_id: input.storeId,
    hostname: input.hostname,
    apex_hostname: input.apexHostname,
    preferred_primary_variant: input.preferredPrimary,
    domain_role: input.role,
    status: 'pending_provisioning' as const,
    next_check_at: new Date().toISOString(),
    created_by: input.createdBy,
  };
  const { data, error } = await client
    .from('store_domains')
    .insert(payload)
    .select('*')
    .single();

  if (!error && data) return toDomain(data as DomainRow);

  if (error?.code !== '23505') {
    throw new DomainRepositoryError('storage_unavailable');
  }

  const { data: existing, error: existingError } = await client
    .from('store_domains')
    .select('*')
    .eq('hostname', input.hostname)
    .maybeSingle();

  if (existingError || !existing) {
    throw new DomainRepositoryError('storage_unavailable');
  }

  const current = toDomain(existing as DomainRow);
  if (current.storeId !== input.storeId) {
    throw new DomainRepositoryError('domain_taken');
  }

  if (current.status !== 'removed') {
    return current;
  }

  const { data: restored, error: restoreError } = await client
    .from('store_domains')
    .update({
      ...payload,
      redirect_to_domain_id: null,
      dns_records: [],
      verification_records: [],
      last_error_code: null,
      attempts: 0,
      last_checked_at: null,
      verified_at: null,
      activated_at: null,
      removed_at: null,
    })
    .eq('id', current.id)
    .eq('store_id', input.storeId)
    .select('*')
    .single();

  if (restoreError || !restored) {
    throw new DomainRepositoryError('storage_unavailable');
  }

  return toDomain(restored as DomainRow);
}

export async function updateStoreDomain(
  domain: Pick<StoreDomain, 'id' | 'storeId'>,
  changes: Partial<{
    configurationId: string;
    apexHostname: string;
    preferredPrimary: 'www' | 'apex';
    role: StoreDomainRole;
    status: StoreDomainStatus;
    redirectToDomainId: string | null;
    dnsRecords: StoreDomain['dnsRecords'];
    verificationRecords: StoreDomain['verificationRecords'];
    lastErrorCode: string | null;
    attempts: number;
    nextCheckAt: string | null;
    lastCheckedAt: string | null;
    verifiedAt: string | null;
    activatedAt: string | null;
    removedAt: string | null;
  }>
) {
  const payload = {
    ...(changes.configurationId !== undefined
      ? { configuration_id: changes.configurationId }
      : {}),
    ...(changes.apexHostname !== undefined
      ? { apex_hostname: changes.apexHostname }
      : {}),
    ...(changes.preferredPrimary !== undefined
      ? { preferred_primary_variant: changes.preferredPrimary }
      : {}),
    ...(changes.role !== undefined ? { domain_role: changes.role } : {}),
    ...(changes.status !== undefined ? { status: changes.status } : {}),
    ...(changes.redirectToDomainId !== undefined
      ? { redirect_to_domain_id: changes.redirectToDomainId }
      : {}),
    ...(changes.dnsRecords !== undefined ? { dns_records: changes.dnsRecords } : {}),
    ...(changes.verificationRecords !== undefined
      ? { verification_records: changes.verificationRecords }
      : {}),
    ...(changes.lastErrorCode !== undefined
      ? { last_error_code: changes.lastErrorCode }
      : {}),
    ...(changes.attempts !== undefined ? { attempts: changes.attempts } : {}),
    ...(changes.nextCheckAt !== undefined
      ? { next_check_at: changes.nextCheckAt }
      : {}),
    ...(changes.lastCheckedAt !== undefined
      ? { last_checked_at: changes.lastCheckedAt }
      : {}),
    ...(changes.verifiedAt !== undefined ? { verified_at: changes.verifiedAt } : {}),
    ...(changes.activatedAt !== undefined
      ? { activated_at: changes.activatedAt }
      : {}),
    ...(changes.removedAt !== undefined ? { removed_at: changes.removedAt } : {}),
  };

  const { data, error } = await adminClient()
    .from('store_domains')
    .update(payload)
    .eq('id', domain.id)
    .eq('store_id', domain.storeId)
    .select('*')
    .single();

  if (error || !data) throw new DomainRepositoryError('storage_unavailable');
  return toDomain(data as DomainRow);
}

export async function recordStoreDomainEvent(input: {
  domain: Pick<StoreDomain, 'id' | 'storeId'>;
  type: DomainEventType;
  fromStatus?: StoreDomainStatus;
  toStatus?: StoreDomainStatus;
  errorCode?: string;
  actorId?: string;
  details?: Record<string, string | number | boolean | null>;
}) {
  const { error } = await adminClient().from('store_domain_events').insert({
    store_domain_id: input.domain.id,
    store_id: input.domain.storeId,
    event_type: input.type,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    error_code: input.errorCode ?? null,
    actor_id: input.actorId ?? null,
    details_json: input.details ?? {},
  });

  if (error) throw new DomainRepositoryError('storage_unavailable');
}

export async function listDomainsDueForVerification(limit = 50) {
  const now = new Date().toISOString();
  const { data, error } = await adminClient()
    .from('store_domains')
    .select('*')
    .in('status', [
      'pending_provisioning',
      'pending_ownership',
      'pending_dns',
      'pending_ssl',
      'failed',
    ])
    .lte('next_check_at', now)
    .order('next_check_at', { ascending: true })
    .limit(limit);

  if (error) throw new DomainRepositoryError('storage_unavailable');
  return (data as DomainRow[]).map(toDomain);
}

export async function activateStoreDomainTransaction(input: {
  domainId: string;
  storeId: string;
  actorId: string;
}) {
  const { error } = await adminClient().rpc('activate_store_domain', {
    p_domain_id: input.domainId,
    p_store_id: input.storeId,
    p_actor_id: input.actorId,
  });

  if (error) throw new DomainRepositoryError('storage_unavailable');
}

export async function releaseRedirectsToRemovedDomain(input: {
  domainId: string;
  storeId: string;
}) {
  const { error } = await adminClient()
    .from('store_domains')
    .update({
      status: 'redirect',
      domain_role: 'redirect',
      redirect_to_domain_id: null,
    })
    .eq('store_id', input.storeId)
    .eq('redirect_to_domain_id', input.domainId)
    .eq('status', 'redirect');

  if (error) throw new DomainRepositoryError('storage_unavailable');
}
