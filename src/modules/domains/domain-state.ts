import type { StoreDomainStatus } from './domain.types';

export function deriveStoreDomainStatus(input: {
  provisioned: boolean;
  ownershipVerified: boolean;
  dnsMisconfigured: boolean;
  httpsProbeMatches: boolean;
}): StoreDomainStatus {
  if (!input.provisioned) return 'pending_provisioning';
  if (!input.ownershipVerified) return 'pending_ownership';
  if (input.dnsMisconfigured) return 'pending_dns';
  if (!input.httpsProbeMatches) return 'pending_ssl';
  return 'ready';
}

export function nextDomainCheckAt(attempts: number, failed = false) {
  const baseSeconds = 5 * 60;
  const seconds = failed
    ? Math.min(baseSeconds * 2 ** Math.max(attempts - 1, 0), 24 * 60 * 60)
    : baseSeconds;

  return new Date(Date.now() + seconds * 1000).toISOString();
}
