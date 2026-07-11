import 'server-only';

import * as Sentry from '@sentry/nextjs';

export function captureOperationalException(input: {
  error: unknown;
  area: 'checkout' | 'payment' | 'webhook' | 'bling' | 'email' | 'shipping';
  storeId?: string;
  code?: string;
}) {
  Sentry.withScope((scope) => {
    scope.setTag('area', input.area);

    if (input.storeId) scope.setTag('store_id', input.storeId);
    if (input.code) scope.setTag('safe_code', input.code);

    scope.setUser(null);
    scope.setExtras({});
    Sentry.captureException(input.error);
  });
}
