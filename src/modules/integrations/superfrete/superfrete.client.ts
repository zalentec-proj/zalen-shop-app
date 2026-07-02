import 'server-only';

import { getSuperFreteQuoteConfig } from './superfrete.config';
import type {
  SuperFreteQuoteRequest,
  SuperFreteQuoteResponse,
} from './superfrete.types';

const REQUEST_TIMEOUT_MS = 8000;

export class SuperFreteQuoteError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number
  ) {
    super(code);
    this.name = 'SuperFreteQuoteError';
  }
}

function buildCalculatorUrl(baseUrl: string) {
  return new URL('/api/v0/calculator', baseUrl).toString();
}

export async function quoteSuperFreteShipping(
  input: SuperFreteQuoteRequest
): Promise<SuperFreteQuoteResponse> {
  const config = getSuperFreteQuoteConfig();

  if (!config.token) {
    throw new SuperFreteQuoteError('superfrete_token_missing');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildCalculatorUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'User-Agent': config.userAgent,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SuperFreteQuoteError(
        'superfrete_quote_failed',
        response.status
      );
    }

    const data = (await response.json()) as unknown;

    if (!Array.isArray(data)) {
      throw new SuperFreteQuoteError('superfrete_quote_invalid_response');
    }

    return data as SuperFreteQuoteResponse;
  } catch (error) {
    if (error instanceof SuperFreteQuoteError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SuperFreteQuoteError('superfrete_quote_timeout');
    }

    throw new SuperFreteQuoteError('superfrete_quote_failed');
  } finally {
    clearTimeout(timeout);
  }
}
