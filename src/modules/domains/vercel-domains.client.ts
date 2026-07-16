import 'server-only';

import { getServerEnv } from '@/lib/env/server';

export type VercelVerificationChallenge = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type VercelProjectDomain = {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  verification?: VercelVerificationChallenge[];
};

export type VercelDomainConfiguration = {
  configuredBy: 'A' | 'CNAME' | 'http' | 'dns-01' | null;
  acceptedChallenges: string[];
  recommendedIPv4: Array<{ rank: number; value: string[] }>;
  recommendedCNAME: Array<{ rank: number; value: string }>;
  misconfigured: boolean;
};

export type VercelDomainsErrorCode =
  | 'provider_unauthorized'
  | 'provider_forbidden'
  | 'domain_conflict'
  | 'domain_invalid'
  | 'provider_rate_limited'
  | 'provider_quota'
  | 'provider_not_found'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_error';

export class VercelDomainsApiError extends Error {
  constructor(
    readonly code: VercelDomainsErrorCode,
    readonly status: number
  ) {
    super(code);
    this.name = 'VercelDomainsApiError';
  }
}

type VercelErrorBody = {
  error?: {
    code?: string;
  };
};

type Fetcher = typeof fetch;

function mapErrorCode(status: number, providerCode?: string): VercelDomainsErrorCode {
  if (status === 401) return 'provider_unauthorized';
  if (status === 403) return 'provider_forbidden';
  if (status === 404) return 'provider_not_found';
  if (status === 409) return 'domain_conflict';
  if (status === 429 || providerCode === 'rate_limited') {
    return 'provider_rate_limited';
  }
  if (status === 402 || providerCode === 'custom_domain_needs_upgrade') {
    return 'provider_quota';
  }
  if (
    status === 400 &&
    ['invalid_name', 'invalid_domain', 'bad_request'].includes(providerCode ?? '')
  ) {
    return 'domain_invalid';
  }
  if (status >= 500) return 'provider_unavailable';
  return 'provider_error';
}

export class VercelDomainsClient {
  constructor(
    private readonly config: {
      token: string;
      projectId: string;
      teamId: string;
      fetcher?: Fetcher;
    }
  ) {}

  private get fetcher() {
    return this.config.fetcher ?? fetch;
  }

  private withTeam(path: string, extra?: Record<string, string>) {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', this.config.teamId);
    Object.entries(extra ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url;
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await this.fetcher(url, {
        ...init,
        headers: {
          authorization: `Bearer ${this.config.token}`,
          'content-type': 'application/json',
          ...init.headers,
        },
        signal: init.signal ?? AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new VercelDomainsApiError('provider_timeout', 504);
      }
      throw new VercelDomainsApiError('provider_unavailable', 503);
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as VercelErrorBody;
      throw new VercelDomainsApiError(
        mapErrorCode(response.status, body.error?.code),
        response.status
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  addProjectDomain(hostname: string) {
    return this.request<VercelProjectDomain>(
      this.withTeam(`/v10/projects/${encodeURIComponent(this.config.projectId)}/domains`),
      {
        method: 'POST',
        body: JSON.stringify({ name: hostname }),
      }
    );
  }

  getProjectDomain(hostname: string) {
    return this.request<VercelProjectDomain>(
      this.withTeam(
        `/v9/projects/${encodeURIComponent(this.config.projectId)}/domains/${encodeURIComponent(hostname)}`
      ),
      { method: 'GET' }
    );
  }

  getDomainConfiguration(hostname: string) {
    return this.request<VercelDomainConfiguration>(
      this.withTeam(`/v6/domains/${encodeURIComponent(hostname)}/config`, {
        projectIdOrName: this.config.projectId,
      }),
      { method: 'GET' }
    );
  }

  verifyProjectDomain(hostname: string) {
    return this.request<VercelProjectDomain>(
      this.withTeam(
        `/v9/projects/${encodeURIComponent(this.config.projectId)}/domains/${encodeURIComponent(hostname)}/verify`
      ),
      { method: 'POST', body: '{}' }
    );
  }

  configureDomainRedirect(hostname: string, redirectTo: string | null) {
    return this.request<VercelProjectDomain>(
      this.withTeam(
        `/v9/projects/${encodeURIComponent(this.config.projectId)}/domains/${encodeURIComponent(hostname)}`
      ),
      {
        method: 'PATCH',
        body: JSON.stringify({
          redirect: redirectTo,
          redirectStatusCode: redirectTo ? 308 : null,
        }),
      }
    );
  }

  removeProjectDomain(hostname: string) {
    return this.request<void>(
      this.withTeam(
        `/v9/projects/${encodeURIComponent(this.config.projectId)}/domains/${encodeURIComponent(hostname)}`
      ),
      { method: 'DELETE' }
    );
  }
}

export function createVercelDomainsClient() {
  const env = getServerEnv();

  if (!env.VERCEL_API_TOKEN || !env.VERCEL_PROJECT_ID || !env.VERCEL_TEAM_ID) {
    throw new VercelDomainsApiError('provider_unavailable', 503);
  }

  return new VercelDomainsClient({
    token: env.VERCEL_API_TOKEN,
    projectId: env.VERCEL_PROJECT_ID,
    teamId: env.VERCEL_TEAM_ID,
  });
}
