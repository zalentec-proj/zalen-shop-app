import 'server-only';

import { getServerEnv } from '@/lib/env/server';

export type InternalJobAuthResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 501;
      errorCode: 'internal_job_secret_not_configured' | 'unauthorized';
    };

function getConfiguredJobSecrets() {
  const env = getServerEnv();

  return [env.CRON_SECRET, env.INTERNAL_JOB_SECRET].filter(
    (secret): secret is string => Boolean(secret)
  );
}

export function authorizeInternalJobRequest(request: Request): InternalJobAuthResult {
  const secrets = getConfiguredJobSecrets();

  if (secrets.length === 0) {
    return {
      ok: false,
      status: 501,
      errorCode: 'internal_job_secret_not_configured',
    };
  }

  const authorization = request.headers.get('authorization')?.trim();
  const internalSecret = request.headers.get('x-internal-job-secret')?.trim();
  const isAuthorized = secrets.some(
    (secret) =>
      authorization === `Bearer ${secret}` || internalSecret === secret
  );

  if (!isAuthorized) {
    return {
      ok: false,
      status: 401,
      errorCode: 'unauthorized',
    };
  }

  return { ok: true };
}
