import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

export type BlingWebhookParseResult =
  | {
      ok: true;
      eventId: string;
      event: string;
      data: Record<string, unknown> | null;
      payload: Record<string, unknown>;
      externalIds: Record<string, string | number>;
    }
  | {
      ok: false;
      errorCode: 'invalid_webhook_payload' | 'missing_event_id' | 'missing_event';
    };

function normalizeSignature(signature: string | null) {
  if (!signature) {
    return undefined;
  }

  const trimmed = signature.trim();
  const withoutPrefix = trimmed.startsWith('sha256=')
    ? trimmed.slice('sha256='.length)
    : trimmed;

  if (!/^[a-f0-9]{64}$/i.test(withoutPrefix)) {
    return undefined;
  }

  return withoutPrefix.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toStringOrNumber(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function extractExternalIds(data: Record<string, unknown> | null) {
  const externalIds: Record<string, string | number> = {};

  if (!data) {
    return externalIds;
  }

  const id = toStringOrNumber(data.id);

  if (id !== undefined) {
    externalIds.id = id;
  }

  for (const key of ['produto', 'pedido', 'deposito', 'contato', 'loja']) {
    const nested = data[key];

    if (!isRecord(nested)) {
      continue;
    }

    const nestedId = toStringOrNumber(nested.id);

    if (nestedId !== undefined) {
      externalIds[`${key}Id`] = nestedId;
    }
  }

  return externalIds;
}

export function isValidBlingWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  clientSecret: string;
}) {
  const receivedHex = normalizeSignature(input.signature);

  if (!receivedHex) {
    return false;
  }

  const expectedHex = createHmac('sha256', input.clientSecret)
    .update(input.rawBody, 'utf8')
    .digest('hex');
  const received = Buffer.from(receivedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function parseBlingWebhookPayload(rawBody: string): BlingWebhookParseResult {
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, errorCode: 'invalid_webhook_payload' };
  }

  if (!isRecord(payload)) {
    return { ok: false, errorCode: 'invalid_webhook_payload' };
  }

  const eventId = typeof payload.eventId === 'string' ? payload.eventId.trim() : '';

  if (!eventId) {
    return { ok: false, errorCode: 'missing_event_id' };
  }

  const event = typeof payload.event === 'string' ? payload.event.trim() : '';

  if (!event) {
    return { ok: false, errorCode: 'missing_event' };
  }

  const data = isRecord(payload.data) ? payload.data : null;

  return {
    ok: true,
    eventId,
    event,
    data,
    payload,
    externalIds: extractExternalIds(data),
  };
}
