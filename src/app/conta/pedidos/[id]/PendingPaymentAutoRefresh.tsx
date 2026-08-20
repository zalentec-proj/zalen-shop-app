'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const AUTO_REFRESH_INTERVAL_MS = 5_000;
const AUTO_REFRESH_DURATION_MS = 2 * 60 * 1_000;

export default function PendingPaymentAutoRefresh({
  expiresAt,
}: {
  expiresAt?: string;
}) {
  const router = useRouter();
  const startedAtRef = useRef<number | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const refreshStatus = useCallback(() => {
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    startedAtRef.current = Date.now();

    const intervalId = window.setInterval(() => {
      const startedAt = startedAtRef.current ?? Date.now();
      const hasReachedPollingLimit =
        Date.now() - startedAt >= AUTO_REFRESH_DURATION_MS;
      const hasExpired = expiresAt
        ? new Date(expiresAt).getTime() <= Date.now()
        : false;

      if (hasReachedPollingLimit || hasExpired) {
        window.clearInterval(intervalId);
        return;
      }

      refreshStatus();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [expiresAt, refreshStatus]);

  return (
    <button
      type="button"
      onClick={refreshStatus}
      disabled={isRefreshing}
      className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-muted transition hover:text-white disabled:cursor-wait disabled:opacity-70"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing
        ? 'Atualizando pagamento...'
        : 'Atualizando automaticamente · Atualizar agora'}
    </button>
  );
}
