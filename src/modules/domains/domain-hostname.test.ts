import { describe, expect, it } from 'vitest';
import {
  getDomainHostnamePlan,
  InvalidDomainHostnameError,
  normalizeCustomDomainHostname,
} from './domain-hostname';

describe('normalizeCustomDomainHostname', () => {
  it('remove protocolo, porta, path e ponto final', () => {
    expect(
      normalizeCustomDomainHostname(' HTTPS://WWW.Exemplo.com.br:443/loja?q=1. ')
    ).toBe('www.exemplo.com.br');
  });

  it('converte IDN para ASCII', () => {
    expect(normalizeCustomDomainHostname('www.café.com.br')).toBe(
      'www.xn--caf-dma.com.br'
    );
  });

  it.each([
    '127.0.0.1',
    'localhost',
    '*.exemplo.com',
    'app.zalenshop.com.br',
    'zalenshop.com.br',
    'loja.local',
    'exemplo.test',
  ])('rejeita hostname proibido: %s', (hostname) => {
    expect(() => normalizeCustomDomainHostname(hostname)).toThrow(
      InvalidDomainHostnameError
    );
  });
});

describe('getDomainHostnamePlan', () => {
  it('usa www como principal padrão para domínio raiz', () => {
    expect(
      getDomainHostnamePlan({
        requestedHostname: 'exemplo.com.br',
        apexHostname: 'exemplo.com.br',
        preferredPrimary: 'www',
      })
    ).toEqual([
      { hostname: 'www.exemplo.com.br', role: 'primary' },
      { hostname: 'exemplo.com.br', role: 'redirect' },
    ]);
  });

  it('permite inverter o principal para o apex', () => {
    expect(
      getDomainHostnamePlan({
        requestedHostname: 'www.exemplo.com.br',
        apexHostname: 'exemplo.com.br',
        preferredPrimary: 'apex',
      })
    ).toEqual([
      { hostname: 'exemplo.com.br', role: 'primary' },
      { hostname: 'www.exemplo.com.br', role: 'redirect' },
    ]);
  });

  it('não cria par para outro subdomínio', () => {
    expect(
      getDomainHostnamePlan({
        requestedHostname: 'loja.exemplo.com.br',
        apexHostname: 'exemplo.com.br',
        preferredPrimary: 'www',
      })
    ).toEqual([{ hostname: 'loja.exemplo.com.br', role: 'primary' }]);
  });
});
