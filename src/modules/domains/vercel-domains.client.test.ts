import { describe, expect, it, vi } from 'vitest';
import {
  VercelDomainsApiError,
  VercelDomainsClient,
} from './vercel-domains.client';

function projectDomain(overrides: Record<string, unknown> = {}) {
  return {
    name: 'www.exemplo.com.br',
    apexName: 'exemplo.com.br',
    projectId: 'project-id',
    verified: false,
    verification: [
      { type: 'TXT', domain: '_vercel.exemplo.com.br', value: 'challenge' },
    ],
    ...overrides,
  };
}

describe('VercelDomainsClient', () => {
  it('adiciona domínio sem force e com escopo de team', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(projectDomain()), { status: 200 })
    );
    const client = new VercelDomainsClient({
      token: 'server-token',
      projectId: 'project-id',
      teamId: 'team-id',
      fetcher,
    });

    await client.addProjectDomain('www.exemplo.com.br');

    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain('/v10/projects/project-id/domains?teamId=team-id');
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'www.exemplo.com.br' });
    expect(String(init?.body)).not.toContain('force');
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer server-token'
    );
  });

  it('mapeia conflito sem expor resposta bruta', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ error: { code: 'domain_already_in_use', message: 'sensitive' } }),
        { status: 409 }
      )
    );
    const client = new VercelDomainsClient({
      token: 'token',
      projectId: 'project',
      teamId: 'team',
      fetcher,
    });

    await expect(client.addProjectDomain('exemplo.com')).rejects.toMatchObject({
      code: 'domain_conflict',
      status: 409,
      message: 'domain_conflict',
    });
  });

  it('configura redirect permanente 308', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(projectDomain({ verified: true })), { status: 200 })
    );
    const client = new VercelDomainsClient({
      token: 'token',
      projectId: 'project',
      teamId: 'team',
      fetcher,
    });

    await client.configureDomainRedirect('exemplo.com', 'www.exemplo.com');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      redirect: 'www.exemplo.com',
      redirectStatusCode: 308,
    });
  });

  it('trata timeout como erro seguro', async () => {
    const timeout = new Error('raw timeout');
    timeout.name = 'TimeoutError';
    const client = new VercelDomainsClient({
      token: 'token',
      projectId: 'project',
      teamId: 'team',
      fetcher: vi.fn<typeof fetch>(async () => {
        throw timeout;
      }),
    });

    await expect(client.getProjectDomain('exemplo.com')).rejects.toEqual(
      new VercelDomainsApiError('provider_timeout', 504)
    );
  });

  it('trata falha parcial de remoção como indisponibilidade', async () => {
    const client = new VercelDomainsClient({
      token: 'token',
      projectId: 'project',
      teamId: 'team',
      fetcher: vi.fn<typeof fetch>(async () => new Response('{}', { status: 503 })),
    });

    await expect(client.removeProjectDomain('exemplo.com')).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
  });
});
