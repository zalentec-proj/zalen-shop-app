import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const reservedSuffixes = ['.local', '.localhost', '.test', '.example', '.invalid'];

export class InvalidDomainHostnameError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'InvalidDomainHostnameError';
  }
}

function extractHostname(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.includes('*')) {
    throw new InvalidDomainHostnameError('domain_invalid');
  }

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
      .hostname;
  } catch {
    throw new InvalidDomainHostnameError('domain_invalid');
  }
}

export function normalizeCustomDomainHostname(
  value: string,
  platformRootDomain = 'zalenshop.com.br'
) {
  const extracted = extractHostname(value).replace(/\.+$/, '').toLowerCase();
  const hostname = domainToASCII(extracted).toLowerCase();

  if (!hostname || hostname.length > 253 || isIP(hostname)) {
    throw new InvalidDomainHostnameError('domain_invalid');
  }

  if (
    hostname === 'localhost' ||
    hostname === platformRootDomain ||
    hostname.endsWith(`.${platformRootDomain}`) ||
    reservedSuffixes.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
    )
  ) {
    throw new InvalidDomainHostnameError('domain_reserved');
  }

  const labels = hostname.split('.');

  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9-]+$/.test(label) ||
        label.startsWith('-') ||
        label.endsWith('-')
    )
  ) {
    throw new InvalidDomainHostnameError('domain_invalid');
  }

  return hostname;
}

export function getDomainHostnamePlan(input: {
  requestedHostname: string;
  apexHostname: string;
  preferredPrimary: 'www' | 'apex';
}) {
  const { requestedHostname, apexHostname, preferredPrimary } = input;
  const wwwHostname = `www.${apexHostname}`;
  const isApexPair =
    requestedHostname === apexHostname || requestedHostname === wwwHostname;

  if (!isApexPair) {
    return [{ hostname: requestedHostname, role: 'primary' as const }];
  }

  const primaryHostname =
    preferredPrimary === 'apex' ? apexHostname : wwwHostname;
  const redirectHostname =
    primaryHostname === apexHostname ? wwwHostname : apexHostname;

  return [
    { hostname: primaryHostname, role: 'primary' as const },
    { hostname: redirectHostname, role: 'redirect' as const },
  ];
}
