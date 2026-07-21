import { createHmac } from 'node:crypto';
import {
  InvalidWebhookSignatureError,
  SignatureFailureReason,
} from 'mercadopago';
import { describe, expect, it } from 'vitest';
import { validateMercadoPagoWebhookSignature } from './mercado-pago-webhook-signature';

const secret = 'webhook-secret-for-tests';
const requestId = 'request-123';
const dataId = '168939464233';

function sign(timestamp: string, signingSecret = secret) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const hash = createHmac('sha256', signingSecret)
    .update(manifest)
    .digest('hex');

  return `ts=${timestamp},v1=${hash}`;
}

describe('Mercado Pago webhook signature', () => {
  it('accepts the documented Unix timestamp in seconds', () => {
    const now = Date.UTC(2026, 6, 21, 14, 0, 0);
    const timestamp = String(Math.floor(now / 1_000));

    expect(() =>
      validateMercadoPagoWebhookSignature({
        xSignature: sign(timestamp),
        xRequestId: requestId,
        dataId,
        secret,
        now: () => now,
      })
    ).not.toThrow();
  });

  it('also accepts a millisecond timestamp within the replay window', () => {
    const now = Date.UTC(2026, 6, 21, 14, 0, 0);
    const timestamp = String(now - 30_000);

    expect(() =>
      validateMercadoPagoWebhookSignature({
        xSignature: sign(timestamp),
        xRequestId: requestId,
        dataId,
        secret,
        now: () => now,
      })
    ).not.toThrow();
  });

  it('rejects an authentic notification outside the replay window', () => {
    const now = Date.UTC(2026, 6, 21, 14, 0, 0);
    const timestamp = String(Math.floor(now / 1_000) - 301);

    expect(() =>
      validateMercadoPagoWebhookSignature({
        xSignature: sign(timestamp),
        xRequestId: requestId,
        dataId,
        secret,
        now: () => now,
      })
    ).toThrowError(
      expect.objectContaining({
        reason: SignatureFailureReason.TimestampOutOfTolerance,
      })
    );
  });

  it('rejects a signature generated with another secret', () => {
    const now = Date.UTC(2026, 6, 21, 14, 0, 0);
    const timestamp = String(Math.floor(now / 1_000));

    expect(() =>
      validateMercadoPagoWebhookSignature({
        xSignature: sign(timestamp, 'wrong-secret'),
        xRequestId: requestId,
        dataId,
        secret,
        now: () => now,
      })
    ).toThrow(InvalidWebhookSignatureError);
  });
});
