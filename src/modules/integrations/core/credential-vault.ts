import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getServerEnv } from '@/lib/env/server';

const credentialVersion = 'v1';

function getEncryptionSecret() {
  return getServerEnv().INTEGRATION_TOKEN_ENCRYPTION_KEY;
}

function getEncryptionKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function isIntegrationCredentialEncryptionConfigured() {
  return Boolean(getEncryptionSecret());
}

export function encryptIntegrationCredentials(payload: unknown): string {
  const secret = getEncryptionSecret();

  if (!secret) {
    throw new Error('Integration credential encryption is not configured.');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    credentialVersion,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptIntegrationCredentials<T>(encryptedPayload: string): T {
  const secret = getEncryptionSecret();

  if (!secret) {
    throw new Error('Integration credential encryption is not configured.');
  }

  const [version, iv, tag, encrypted] = encryptedPayload.split(':');

  if (version !== credentialVersion || !iv || !tag || !encrypted) {
    throw new Error('Unsupported integration credential payload.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(secret),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}
