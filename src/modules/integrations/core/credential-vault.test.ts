import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = {
  INTEGRATION_TOKEN_ENCRYPTION_KEY: 'current-key',
  INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS: undefined as string | undefined,
};

vi.mock('@/lib/env/server', () => ({
  getServerEnv: () => env,
}));

import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from './credential-vault';

describe('integration credential vault', () => {
  beforeEach(() => {
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY = 'current-key';
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS = undefined;
  });

  it('criptografa e descriptografa com a chave atual', () => {
    const encrypted = encryptIntegrationCredentials({ accessToken: 'secret' });

    expect(decryptIntegrationCredentials(encrypted)).toEqual({
      accessToken: 'secret',
    });
  });

  it('aceita a chave anterior somente para descriptografia durante rotação', () => {
    const encryptedWithPrevious = encryptIntegrationCredentials({
      accessToken: 'legacy-secret',
    });

    env.INTEGRATION_TOKEN_ENCRYPTION_KEY = 'rotated-key';
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS = 'current-key';

    expect(decryptIntegrationCredentials(encryptedWithPrevious)).toEqual({
      accessToken: 'legacy-secret',
    });

    const encryptedWithCurrent = encryptIntegrationCredentials({
      accessToken: 'current-secret',
    });
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY = 'current-key';
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS = undefined;

    expect(() => decryptIntegrationCredentials(encryptedWithCurrent)).toThrow(
      'Unable to decrypt integration credentials.'
    );
  });
});
