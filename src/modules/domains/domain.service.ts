import 'server-only';

import { randomUUID } from 'node:crypto';
import { getServerEnv } from '@/lib/env/server';
import type { StoreContext } from '@/modules/stores/store.types';
import { getDomainHostnamePlan, normalizeCustomDomainHostname } from './domain-hostname';
import { isDomainSelfServiceAvailable } from './domain-config';
import {
  activateStoreDomainTransaction,
  createStoreDomainRequest,
  getActivePrimaryStoreDomain,
  getStoreDomain,
  getStoreDomainByHostname,
  listDomainsDueForVerification,
  listStoreDomains,
  recordStoreDomainEvent,
  releaseRedirectsToRemovedDomain,
  updateStoreDomain,
} from './domain.repository';
import { deriveStoreDomainStatus, nextDomainCheckAt } from './domain-state';
import type { DomainDnsRecord, StoreDomain } from './domain.types';
import {
  createVercelDomainsClient,
  VercelDomainsApiError,
  type VercelDomainConfiguration,
  type VercelProjectDomain,
} from './vercel-domains.client';

export class DomainOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'DomainOperationError';
  }
}

function routingRecords(
  hostname: string,
  apexHostname: string,
  configuration: VercelDomainConfiguration
): DomainDnsRecord[] {
  if (hostname === apexHostname) {
    const ranked = [...configuration.recommendedIPv4].sort(
      (left, right) => left.rank - right.rank
    );
    const preferredRank = ranked[0]?.rank;
    const preferred = ranked
      .filter((entry) => entry.rank === preferredRank)
      .flatMap((entry) => entry.value)
      .filter(Boolean);

    return preferred.map((value) => ({
      type: 'A' as const,
      name: hostname,
      value,
      purpose: 'routing' as const,
    }));
  }

  const preferred = [...configuration.recommendedCNAME]
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.value)
    .filter(Boolean)
    .slice(0, 1);

  return preferred.map((value) => ({
    type: 'CNAME' as const,
    name: hostname,
    value,
    purpose: 'routing' as const,
  }));
}

function ownershipRecords(projectDomain: VercelProjectDomain): DomainDnsRecord[] {
  return (projectDomain.verification ?? [])
    .filter((challenge) => challenge.type.toUpperCase() === 'TXT')
    .map((challenge) => ({
      type: 'TXT' as const,
      name: challenge.domain,
      value: challenge.value,
      purpose: 'ownership' as const,
    }));
}

async function httpsProbeMatches(domain: StoreDomain) {
  const url = new URL(
    '/.well-known/zalen-domain-verification',
    `https://${domain.hostname}`
  );
  url.searchParams.set('configuration', domain.configurationId);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'user-agent': 'Zalen-Domain-Verification/1.0' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return false;
    const body = (await response.json()) as {
      ok?: boolean;
      configurationId?: string;
    };
    return body.ok === true && body.configurationId === domain.configurationId;
  } catch {
    return false;
  }
}

async function getProjectDomainIdempotently(hostname: string) {
  const client = createVercelDomainsClient();

  try {
    return await client.addProjectDomain(hostname);
  } catch (error) {
    if (
      error instanceof VercelDomainsApiError &&
      (error.code === 'domain_conflict' || error.status === 400)
    ) {
      try {
        return await client.getProjectDomain(hostname);
      } catch {
        throw error;
      }
    }

    throw error;
  }
}

function operationErrorCode(error: unknown) {
  if (error instanceof VercelDomainsApiError) return error.code;
  if (error instanceof DomainOperationError) return error.code;
  return 'domain_operation_failed';
}

async function saveFailure(domain: StoreDomain, error: unknown, actorId?: string) {
  const attempts = domain.attempts + 1;
  const code = operationErrorCode(error);
  const failed = await updateStoreDomain(domain, {
    status: 'failed',
    attempts,
    lastErrorCode: code,
    lastCheckedAt: new Date().toISOString(),
    nextCheckAt: nextDomainCheckAt(attempts, true),
  });
  await recordStoreDomainEvent({
    domain,
    type: 'operation_failed',
    fromStatus: domain.status,
    toStatus: failed.status,
    errorCode: code,
    actorId,
  });
  return failed;
}

async function persistObservedStatus(input: {
  domain: StoreDomain;
  projectDomain: VercelProjectDomain;
  configuration: VercelDomainConfiguration;
  actorId?: string;
}) {
  const { domain, projectDomain, configuration, actorId } = input;
  const probeMatches =
    projectDomain.verified && !configuration.misconfigured
      ? await httpsProbeMatches(domain)
      : false;
  const status = deriveStoreDomainStatus({
    provisioned: projectDomain.projectId.length > 0,
    ownershipVerified: projectDomain.verified,
    dnsMisconfigured: configuration.misconfigured,
    httpsProbeMatches: probeMatches,
  });
  const checkedAt = new Date().toISOString();
  let updated = await updateStoreDomain(domain, {
    apexHostname: projectDomain.apexName.toLowerCase(),
    status,
    dnsRecords: routingRecords(
      domain.hostname,
      projectDomain.apexName.toLowerCase(),
      configuration
    ),
    verificationRecords: ownershipRecords(projectDomain),
    lastErrorCode: null,
    attempts: 0,
    lastCheckedAt: checkedAt,
    nextCheckAt: status === 'ready' ? null : nextDomainCheckAt(0),
    verifiedAt: projectDomain.verified ? domain.verifiedAt ?? checkedAt : null,
  });
  await recordStoreDomainEvent({
    domain,
    type: domain.status === 'pending_provisioning'
      ? 'provider_provisioned'
      : 'status_checked',
    fromStatus: domain.status,
    toStatus: status,
    actorId,
  });

  if (updated.status === 'ready' && updated.role === 'redirect') {
    const primary = await getActivePrimaryStoreDomain(updated.storeId);

    if (primary && primary.id !== updated.id) {
      try {
        await createVercelDomainsClient().configureDomainRedirect(
          updated.hostname,
          primary.hostname
        );
        updated = await updateStoreDomain(updated, {
          status: 'redirect',
          redirectToDomainId: primary.id,
        });
        await recordStoreDomainEvent({
          domain: updated,
          type: 'redirect_configured',
          fromStatus: 'ready',
          toStatus: 'redirect',
          actorId,
          details: { target: primary.hostname, statusCode: 308 },
        });
      } catch (error) {
        await recordStoreDomainEvent({
          domain: updated,
          type: 'operation_failed',
          errorCode: operationErrorCode(error),
          actorId,
        });
      }
    }
  }

  return updated;
}

async function provisionDomain(domain: StoreDomain, actorId?: string) {
  try {
    const client = createVercelDomainsClient();
    const projectDomain = await getProjectDomainIdempotently(domain.hostname);
    const configuration = await client.getDomainConfiguration(domain.hostname);
    return await persistObservedStatus({
      domain,
      projectDomain,
      configuration,
      actorId,
    });
  } catch (error) {
    return saveFailure(domain, error, actorId);
  }
}

async function ensureHostnamePlan(domain: StoreDomain, actorId: string) {
  if (domain.status === 'failed') return [domain];

  const plan = getDomainHostnamePlan({
    requestedHostname: domain.hostname,
    apexHostname: domain.apexHostname,
    preferredPrimary: domain.preferredPrimary,
  });
  const domains: StoreDomain[] = [];

  for (const item of plan) {
    const before = await getStoreDomainByHostname(item.hostname);
    let current =
      item.hostname === domain.hostname
        ? await updateStoreDomain(domain, {
            role:
              domain.status === 'active' ? domain.role : item.role,
            apexHostname: domain.apexHostname,
            preferredPrimary: domain.preferredPrimary,
          })
        : await createStoreDomainRequest({
            configurationId: domain.configurationId,
            storeId: domain.storeId,
            hostname: item.hostname,
            apexHostname: domain.apexHostname,
            preferredPrimary: domain.preferredPrimary,
            role: item.role,
            createdBy: actorId,
          });

    if (before && before.storeId !== domain.storeId) {
      throw new DomainOperationError('domain_taken');
    }

    if (before && before.status === 'active') {
      current = before;
    } else if (
      current.status === 'pending_provisioning' ||
      current.status === 'failed'
    ) {
      current = await provisionDomain(current, actorId);
    }
    domains.push(current);
  }

  return domains;
}

async function observeDomain(
  domain: StoreDomain,
  options: { attemptOwnershipVerification?: boolean; actorId?: string } = {}
) {
  try {
    const client = createVercelDomainsClient();
    let projectDomain = await client.getProjectDomain(domain.hostname);

    if (!projectDomain.verified && options.attemptOwnershipVerification) {
      try {
        projectDomain = await client.verifyProjectDomain(domain.hostname);
      } catch (error) {
        if (!(error instanceof VercelDomainsApiError && error.status === 400)) {
          throw error;
        }
        projectDomain = await client.getProjectDomain(domain.hostname);
      }
    }

    const configuration = await client.getDomainConfiguration(domain.hostname);
    return await persistObservedStatus({
      domain,
      projectDomain,
      configuration,
      actorId: options.actorId,
    });
  } catch (error) {
    if (
      error instanceof VercelDomainsApiError &&
      error.code === 'provider_not_found'
    ) {
      return provisionDomain(domain, options.actorId);
    }
    return saveFailure(domain, error, options.actorId);
  }
}

function assertFeatureAvailable(store: Pick<StoreContext, 'id' | 'slug'>) {
  if (!isDomainSelfServiceAvailable(store)) {
    throw new DomainOperationError('domain_self_service_disabled');
  }
}

export async function requestCustomDomain(input: {
  store: Pick<StoreContext, 'id' | 'slug'>;
  actorId: string;
  hostname: string;
  preferredPrimary: 'www' | 'apex';
}) {
  assertFeatureAvailable(input.store);
  const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';
  const requestedHostname = normalizeCustomDomainHostname(
    input.hostname,
    rootDomain
  );
  const existing = await getStoreDomainByHostname(requestedHostname);

  if (existing) {
    if (existing.storeId !== input.store.id) {
      throw new DomainOperationError('domain_taken');
    }

    const domains = await listStoreDomains(input.store.id);
    return domains.filter(
      (domain) => domain.configurationId === existing.configurationId
    );
  }

  const configurationId = randomUUID();
  let requested = await createStoreDomainRequest({
    configurationId,
    storeId: input.store.id,
    hostname: requestedHostname,
    apexHostname: requestedHostname.startsWith('www.')
      ? requestedHostname.slice(4)
      : requestedHostname,
    preferredPrimary: input.preferredPrimary,
    role: 'primary',
    createdBy: input.actorId,
  });

  await recordStoreDomainEvent({
    domain: requested,
    type: 'domain_requested',
    toStatus: requested.status,
    actorId: input.actorId,
  });
  requested = await provisionDomain(requested, input.actorId);

  return ensureHostnamePlan(requested, input.actorId);
}

export async function verifyCustomDomainNow(input: {
  store: Pick<StoreContext, 'id' | 'slug'>;
  domainId: string;
  actorId: string;
}) {
  assertFeatureAvailable(input.store);
  const domain = await getStoreDomain({
    domainId: input.domainId,
    storeId: input.store.id,
  });
  if (!domain || domain.status === 'removed' || domain.status === 'removing') {
    throw new DomainOperationError('domain_not_found');
  }
  return observeDomain(domain, {
    attemptOwnershipVerification: true,
    actorId: input.actorId,
  });
}

export async function retryCustomDomain(input: {
  store: Pick<StoreContext, 'id' | 'slug'>;
  domainId: string;
  actorId: string;
}) {
  assertFeatureAvailable(input.store);
  const domain = await getStoreDomain({
    domainId: input.domainId,
    storeId: input.store.id,
  });
  if (!domain) throw new DomainOperationError('domain_not_found');
  const provisioned = await provisionDomain(domain, input.actorId);
  await ensureHostnamePlan(provisioned, input.actorId);
  return provisioned;
}

export async function activateCustomDomain(input: {
  store: Pick<StoreContext, 'id' | 'slug'>;
  domainId: string;
  actorId: string;
}) {
  assertFeatureAvailable(input.store);
  const domain = await getStoreDomain({
    domainId: input.domainId,
    storeId: input.store.id,
  });
  if (!domain || !['ready', 'active', 'redirect'].includes(domain.status)) {
    throw new DomainOperationError('domain_not_ready');
  }

  const client = createVercelDomainsClient();
  await client.configureDomainRedirect(domain.hostname, null);

  await activateStoreDomainTransaction({
    domainId: domain.id,
    storeId: input.store.id,
    actorId: input.actorId,
  });

  const domains = await listStoreDomains(input.store.id);
  for (const current of domains) {
    if (current.status !== 'active' && current.status !== 'redirect') continue;
    const target = current.status === 'active' ? null : domain.hostname;
    try {
      await client.configureDomainRedirect(current.hostname, target);
      if (target) {
        await recordStoreDomainEvent({
          domain: current,
          type: 'redirect_configured',
          actorId: input.actorId,
          details: { target, statusCode: 308 },
        });
      }
    } catch (error) {
      await recordStoreDomainEvent({
        domain: current,
        type: 'operation_failed',
        errorCode: operationErrorCode(error),
        actorId: input.actorId,
      });
    }
  }
}

export async function removeCustomDomain(input: {
  store: Pick<StoreContext, 'id' | 'slug'>;
  domainId: string;
  confirmation: string;
  actorId: string;
}) {
  assertFeatureAvailable(input.store);
  const domain = await getStoreDomain({
    domainId: input.domainId,
    storeId: input.store.id,
  });
  if (!domain) throw new DomainOperationError('domain_not_found');
  if (input.confirmation.trim().toLowerCase() !== domain.hostname) {
    throw new DomainOperationError('domain_confirmation_mismatch');
  }

  await updateStoreDomain(domain, {
    status: 'removing',
    lastErrorCode: null,
  });
  await recordStoreDomainEvent({
    domain,
    type: 'domain_removal_requested',
    fromStatus: domain.status,
    toStatus: 'removing',
    actorId: input.actorId,
  });

  try {
    await createVercelDomainsClient().removeProjectDomain(domain.hostname);
  } catch (error) {
    if (
      !(error instanceof VercelDomainsApiError) ||
      error.code !== 'provider_not_found'
    ) {
      const code = operationErrorCode(error);
      await updateStoreDomain(domain, {
        status: domain.status,
        attempts: domain.attempts + 1,
        lastErrorCode: code,
      });
      await recordStoreDomainEvent({
        domain,
        type: 'operation_failed',
        fromStatus: 'removing',
        toStatus: domain.status,
        errorCode: code,
        actorId: input.actorId,
      });
      throw new DomainOperationError(operationErrorCode(error));
    }
  }

  const now = new Date().toISOString();
  await updateStoreDomain(domain, {
    status: 'removed',
    role: 'redirect',
    redirectToDomainId: null,
    nextCheckAt: null,
    removedAt: now,
  });
  await releaseRedirectsToRemovedDomain({
    domainId: domain.id,
    storeId: domain.storeId,
  });
  await recordStoreDomainEvent({
    domain,
    type: 'domain_removed',
    fromStatus: 'removing',
    toStatus: 'removed',
    actorId: input.actorId,
  });

  const platformTarget = `${input.store.slug}.${
    getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br'
  }`;
  const activePrimary = await getActivePrimaryStoreDomain(input.store.id);
  const redirectTarget = activePrimary?.hostname ?? platformTarget;
  const remaining = await listStoreDomains(input.store.id);
  for (const redirect of remaining.filter((item) => item.status === 'redirect')) {
    await createVercelDomainsClient()
      .configureDomainRedirect(redirect.hostname, redirectTarget)
      .catch(() => undefined);
  }
}

export async function verifyDueCustomDomains() {
  const domains = await listDomainsDueForVerification(50);
  let ready = 0;
  let pending = 0;
  let failed = 0;

  for (const domain of domains) {
    const result = await observeDomain(domain, {
      attemptOwnershipVerification: domain.status === 'pending_ownership',
    });
    if (result.status === 'ready') ready += 1;
    else if (result.status === 'failed') failed += 1;
    else pending += 1;
  }

  return { processed: domains.length, ready, pending, failed };
}
