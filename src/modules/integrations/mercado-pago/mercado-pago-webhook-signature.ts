import {
  InvalidWebhookSignatureError,
  SignatureFailureReason,
  WebhookSignatureValidator,
} from 'mercadopago';

const DEFAULT_TOLERANCE_SECONDS = 300;
const MILLISECONDS_THRESHOLD = 100_000_000_000;

type ValidateMercadoPagoWebhookSignatureInput = {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: () => number;
};

function getSignatureTimestamp(xSignature: string | null | undefined) {
  let timestamp: string | undefined;

  for (const part of xSignature?.split(',') ?? []) {
    const separatorIndex = part.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const value = part.slice(separatorIndex + 1).trim();

    if (key === 'ts' && value) {
      timestamp = value;
    }
  }

  return timestamp;
}

function toTimestampMilliseconds(timestamp: string) {
  const parsed = Number(timestamp);

  if (!Number.isSafeInteger(parsed)) {
    return undefined;
  }

  return parsed < MILLISECONDS_THRESHOLD ? parsed * 1_000 : parsed;
}

export function validateMercadoPagoWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  now = Date.now,
}: ValidateMercadoPagoWebhookSignatureInput) {
  // The official SDK validates the HMAC. Its optional tolerance currently
  // treats `ts` as milliseconds, while Mercado Pago documents and emits a
  // Unix timestamp in seconds. Enforce replay tolerance separately so both
  // documented seconds and a future millisecond timestamp remain safe.
  WebhookSignatureValidator.validate({
    xSignature,
    xRequestId,
    dataId,
    secret,
  });

  const timestamp = getSignatureTimestamp(xSignature);
  const timestampMilliseconds = timestamp
    ? toTimestampMilliseconds(timestamp)
    : undefined;

  if (
    !timestamp ||
    timestampMilliseconds === undefined ||
    Math.abs(now() - timestampMilliseconds) > toleranceSeconds * 1_000
  ) {
    throw new InvalidWebhookSignatureError(
      SignatureFailureReason.TimestampOutOfTolerance,
      xRequestId ?? undefined,
      timestamp
    );
  }
}
