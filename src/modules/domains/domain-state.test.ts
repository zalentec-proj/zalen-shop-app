import { describe, expect, it, vi } from 'vitest';
import { deriveStoreDomainStatus, nextDomainCheckAt } from './domain-state';

describe('deriveStoreDomainStatus', () => {
  it.each([
    [{ provisioned: false, ownershipVerified: false, dnsMisconfigured: true, httpsProbeMatches: false }, 'pending_provisioning'],
    [{ provisioned: true, ownershipVerified: false, dnsMisconfigured: true, httpsProbeMatches: false }, 'pending_ownership'],
    [{ provisioned: true, ownershipVerified: true, dnsMisconfigured: true, httpsProbeMatches: false }, 'pending_dns'],
    [{ provisioned: true, ownershipVerified: true, dnsMisconfigured: false, httpsProbeMatches: false }, 'pending_ssl'],
    [{ provisioned: true, ownershipVerified: true, dnsMisconfigured: false, httpsProbeMatches: true }, 'ready'],
  ] as const)('mapeia a máquina de estados', (input, expected) => {
    expect(deriveStoreDomainStatus(input)).toBe(expected);
  });
});

describe('nextDomainCheckAt', () => {
  it('aplica backoff e limita em 24 horas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    expect(nextDomainCheckAt(1, true)).toBe('2026-07-16T12:05:00.000Z');
    expect(nextDomainCheckAt(2, true)).toBe('2026-07-16T12:10:00.000Z');
    expect(nextDomainCheckAt(99, true)).toBe('2026-07-17T12:00:00.000Z');

    vi.useRealTimers();
  });
});
