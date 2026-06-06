import 'server-only';

import { z } from 'zod';
import { decryptIntegrationCredentials } from '../../core/credential-vault';
import { getBlingOAuthConfig } from '../bling.config';
import {
  getBlingEncryptedCredentialsFromRepository,
  recordBlingHomologationEventInRepository,
} from '../bling.repository';
import { saveBlingOAuthTokens } from '../bling.service';
import { BlingHomologationClient, maxTotalMs } from './bling-homologation.client';
import type { BlingEnvironment } from '../bling.types';
import type {
  BlingHomologationCredentials,
  BlingHomologationResult,
  BlingHomologationStepResult,
} from './bling-homologation.types';

const credentialsSchema = z.object({
  provider: z.literal('bling'),
  environment: z.string().optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.string().optional(),
  scope: z.string().optional(),
  expiresIn: z.number().optional(),
  receivedAt: z.string().optional(),
});

const stepOrder: BlingHomologationStepResult[] = [
  { key: 'get_product', label: 'GET produtos', status: 'pending' },
  { key: 'post_product', label: 'POST produto', status: 'pending' },
  { key: 'put_product', label: 'PUT produto', status: 'pending' },
  { key: 'patch_product_situation', label: 'PATCH situação', status: 'pending' },
  { key: 'delete_product', label: 'DELETE produto', status: 'pending' },
];

function createErrorResult(input: {
  environment: BlingEnvironment;
  startedAt: string;
  errorCode: string;
  steps?: BlingHomologationStepResult[];
  tokenRefreshed?: boolean;
}): BlingHomologationResult {
  const finishedAt = new Date().toISOString();

  return {
    status: 'error',
    environment: input.environment,
    startedAt: input.startedAt,
    finishedAt,
    durationMs: Math.max(
      0,
      new Date(finishedAt).getTime() - new Date(input.startedAt).getTime()
    ),
    tokenRefreshed: input.tokenRefreshed ?? false,
    steps: input.steps ?? stepOrder,
    errorCode: input.errorCode,
  };
}

function sanitizeSummary(result: BlingHomologationResult) {
  return {
    status: result.status,
    durationMs: result.durationMs,
    tokenRefreshed: result.tokenRefreshed,
    productId: result.productId,
    errorCode: result.errorCode,
    steps: result.steps.map((step) => ({
      key: step.key,
      status: step.status,
      statusCode: step.statusCode,
      errorCode: step.errorCode,
    })),
  };
}

function parseCredentials(encryptedPayload: string): BlingHomologationCredentials {
  const decrypted = decryptIntegrationCredentials<unknown>(encryptedPayload);
  const parsed = credentialsSchema.safeParse(decrypted);

  if (!parsed.success) {
    throw new Error('Invalid Bling credential payload.');
  }

  return parsed.data;
}

export async function runBlingHomologation(
  storeId: string
): Promise<BlingHomologationResult> {
  const startedAt = new Date().toISOString();
  const config = getBlingOAuthConfig();
  const environment = config.environment;
  const deadline = Date.now() + maxTotalMs;

  const credentialRecord = await getBlingEncryptedCredentialsFromRepository(storeId);

  if (!credentialRecord) {
    return createErrorResult({
      environment,
      startedAt,
      errorCode: 'missing_connected_credentials',
    });
  }

  await recordBlingHomologationEventInRepository({
    storeId,
    environment,
    event: 'homologation_started',
    status: 'running',
  });

  let tokenRefreshed = false;

  try {
    const credentials = parseCredentials(credentialRecord.credentialsEncrypted);
    const client = new BlingHomologationClient({
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      onTokensRefreshed: async (tokens) => {
        tokenRefreshed = true;
        await saveBlingOAuthTokens({
          storeId,
          tokens,
        });
      },
    });
    const run = await client.run(deadline);
    const finishedAt = new Date().toISOString();
    const result: BlingHomologationResult = {
      status: 'success',
      environment,
      startedAt,
      finishedAt,
      durationMs: Math.max(
        0,
        new Date(finishedAt).getTime() - new Date(startedAt).getTime()
      ),
      productId: run.productId,
      tokenRefreshed: tokenRefreshed || client.hasRefreshedToken(),
      steps: run.steps,
    };

    await recordBlingHomologationEventInRepository({
      storeId,
      environment,
      event: 'homologation_success',
      status: 'success',
      summary: sanitizeSummary(result),
    });

    return result;
  } catch (error) {
    const errorCode =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'homologation_failed';
    const failedSteps =
      error && typeof error === 'object' && 'step' in error
        ? stepOrder.map((step) =>
            step.key === (error as { step?: string }).step
              ? {
                  ...step,
                  status: 'error' as const,
                  errorCode,
                }
              : step
          )
        : stepOrder;
    const result = createErrorResult({
      environment,
      startedAt,
      errorCode,
      steps: failedSteps,
      tokenRefreshed,
    });

    await recordBlingHomologationEventInRepository({
      storeId,
      environment,
      event: 'homologation_failed',
      status: 'error',
      summary: sanitizeSummary(result),
    });

    return result;
  }
}
