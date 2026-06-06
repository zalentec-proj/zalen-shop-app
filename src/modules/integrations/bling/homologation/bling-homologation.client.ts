import 'server-only';

import { getBlingOAuthConfig } from '../bling.config';
import { refreshBlingAccessToken } from '../bling.oauth';
import type { BlingTokenResponse } from '../bling.types';
import type {
  BlingHomologationClientInput,
  BlingHomologationStepKey,
  BlingHomologationStepResult,
} from './bling-homologation.types';

const baseUrl = 'https://api.bling.com.br/Api/v3/homologacao';
const homologationHeaderName = 'x-bling-homologacao';
const maxRequestMs = 2000;
const maxTotalMs = 10000;

const stepLabels: Record<BlingHomologationStepKey, string> = {
  get_product: 'GET produtos',
  post_product: 'POST produto',
  put_product: 'PUT produto',
  patch_product_situation: 'PATCH situação',
  delete_product: 'DELETE produto',
};

type BlingHomologationResponse = {
  status: number;
  body: unknown;
  homologationHeader?: string;
};

class BlingHomologationClientError extends Error {
  constructor(
    public readonly step: BlingHomologationStepKey,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly steps?: BlingHomologationStepResult[]
  ) {
    super(code);
    this.name = 'BlingHomologationClientError';
  }
}

function getRemainingMs(deadline: number) {
  return Math.max(0, deadline - Date.now());
}

function createAbortSignal(deadline: number) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Math.min(maxRequestMs, getRemainingMs(deadline)))
  );

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getData(response: unknown): unknown {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: unknown }).data;
  }

  return undefined;
}

function getProductId(response: unknown): number | null {
  const data = getData(response);

  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }

  return null;
}

function isInvalidTokenResponse(status: number, body: unknown) {
  if (status === 401 || status === 403) {
    return true;
  }

  if (!body || typeof body !== 'object') {
    return false;
  }

  const bodyRecord = body as Record<string, unknown>;
  const error = bodyRecord.error;

  if (typeof error === 'string') {
    return /token|unauthorized|invalid/i.test(error);
  }

  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    const type = (error as Record<string, unknown>).type;
    return [message, type].some(
      (value) => typeof value === 'string' && /token|unauthorized|invalid/i.test(value)
    );
  }

  return false;
}

function shouldAttemptRefresh(status: number, body: unknown) {
  if (isInvalidTokenResponse(status, body)) {
    return true;
  }

  // Bling's homologation can invalidate the access token during one step and
  // may return a generic 400 instead of a classic 401/403 auth response.
  return status === 400;
}

function assertSuccess(
  step: BlingHomologationStepKey,
  response: BlingHomologationResponse
) {
  if (response.status < 200 || response.status >= 300) {
    throw new BlingHomologationClientError(
      step,
      'request_failed',
      response.status
    );
  }
}

function assertHomologationHeader(
  step: BlingHomologationStepKey,
  response: BlingHomologationResponse
) {
  if (!response.homologationHeader) {
    throw new BlingHomologationClientError(
      step,
      'missing_homologation_header',
      response.status
    );
  }

  return response.homologationHeader;
}

export class BlingHomologationClient {
  private accessToken: string;
  private refreshToken: string;
  private didRefresh = false;
  private tokenRefreshed = false;

  constructor(private readonly input: BlingHomologationClientInput) {
    this.accessToken = input.accessToken;
    this.refreshToken = input.refreshToken;
  }

  hasRefreshedToken() {
    return this.tokenRefreshed;
  }

  private async refreshTokenOnce(step: BlingHomologationStepKey) {
    if (this.didRefresh) {
      throw new BlingHomologationClientError(
        step,
        'token_refresh_already_attempted'
      );
    }

    this.didRefresh = true;

    const tokens = await refreshBlingAccessToken(
      getBlingOAuthConfig(),
      this.refreshToken
    );

    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenRefreshed = true;
    await this.input.onTokensRefreshed(tokens);
  }

  private async request(
    step: BlingHomologationStepKey,
    path: string,
    init: {
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      homologationHeader?: string;
      deadline: number;
    },
    retried = false
  ): Promise<BlingHomologationResponse> {
    if (getRemainingMs(init.deadline) <= 0) {
      throw new BlingHomologationClientError(step, 'homologation_timeout');
    }

    const abort = createAbortSignal(init.deadline);

    try {
      const headers = new Headers({
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      });

      if (init.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }

      if (init.homologationHeader) {
        headers.set(homologationHeaderName, init.homologationHeader);
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
        signal: abort.signal,
      });
      const text = await response.text();
      const body = parseJson(text);

      if (!response.ok && !retried && shouldAttemptRefresh(response.status, body)) {
        await this.refreshTokenOnce(step);
        return this.request(step, path, init, true);
      }

      return {
        status: response.status,
        body,
        homologationHeader:
          response.headers.get(homologationHeaderName) ?? undefined,
      };
    } catch (error) {
      if (error instanceof BlingHomologationClientError) {
        throw error;
      }

      throw new BlingHomologationClientError(step, 'request_exception');
    } finally {
      abort.clear();
    }
  }

  async run(deadline: number) {
    const steps: BlingHomologationStepResult[] = [];

    const runStep = async (
      key: BlingHomologationStepKey,
      operation: () => Promise<BlingHomologationResponse>
    ) => {
      try {
        const response = await operation();
        assertSuccess(key, response);
        steps.push({
          key,
          label: stepLabels[key],
          status: 'success',
          statusCode: response.status,
        });
        return response;
      } catch (error) {
        const clientError =
          error instanceof BlingHomologationClientError
            ? error
            : new BlingHomologationClientError(key, 'unknown_error');

        steps.push({
          key,
          label: stepLabels[key],
          status: 'error',
          statusCode: clientError.statusCode,
          errorCode: clientError.code,
        });

        throw new BlingHomologationClientError(
          clientError.step,
          clientError.code,
          clientError.statusCode,
          [...steps]
        );
      }
    };

    const getResponse = await runStep('get_product', () =>
      this.request('get_product', '/produtos', {
        method: 'GET',
        deadline,
      })
    );
    const productData = getData(getResponse.body);
    const firstHeader = assertHomologationHeader('get_product', getResponse);

    if (!productData || typeof productData !== 'object') {
      throw new BlingHomologationClientError('get_product', 'invalid_get_payload');
    }

    const postResponse = await runStep('post_product', () =>
      this.request('post_product', '/produtos', {
        method: 'POST',
        body: productData,
        homologationHeader: firstHeader,
        deadline,
      })
    );
    const productId = getProductId(postResponse.body);
    const secondHeader = assertHomologationHeader('post_product', postResponse);

    if (!productId) {
      throw new BlingHomologationClientError('post_product', 'missing_product_id');
    }

    const putResponse = await runStep('put_product', () =>
      this.request('put_product', `/produtos/${productId}`, {
        method: 'PUT',
        body: {
          ...(productData as Record<string, unknown>),
          nome: 'Copo',
        },
        homologationHeader: secondHeader,
        deadline,
      })
    );
    const thirdHeader = assertHomologationHeader('put_product', putResponse);

    const patchResponse = await runStep('patch_product_situation', () =>
      this.request('patch_product_situation', `/produtos/${productId}/situacoes`, {
        method: 'PATCH',
        body: {
          situacao: 'I',
        },
        homologationHeader: thirdHeader,
        deadline,
      })
    );
    const fourthHeader = assertHomologationHeader(
      'patch_product_situation',
      patchResponse
    );

    await runStep('delete_product', () =>
      this.request('delete_product', `/produtos/${productId}`, {
        method: 'DELETE',
        homologationHeader: fourthHeader,
        deadline,
      })
    );

    return {
      productId,
      steps,
    };
  }
}

export { maxTotalMs };
