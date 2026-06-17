'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import type { BlingAdminState } from '@/modules/integrations/bling/bling.types';

type InventorySyncState = NonNullable<BlingAdminState['inventorySync']>;
type InventorySyncSummary = NonNullable<InventorySyncState['summary']>;

type SyncResponse = {
  status: 'success' | 'error';
  summary?: InventorySyncSummary;
  errorCode?: string;
};

const safeErrorLabel: Record<string, string> = {
  access_denied: 'Sua conta não possui acesso à loja ativa.',
  bling_not_connected: 'Conecte o Bling antes de sincronizar estoque.',
  inventory_sync_already_running: 'Já existe uma sincronização de estoque em andamento.',
  invalid_bling_credentials: 'Credenciais Bling inválidas. Reconecte a integração.',
  missing_session: 'Sessão expirada. Faça login novamente.',
};

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function BlingInventorySyncPanel({
  canRun,
  initialStatus,
  initialUpdatedAt,
  initialSummary,
}: {
  canRun: boolean;
  initialStatus?: InventorySyncState['status'];
  initialUpdatedAt?: string;
  initialSummary?: InventorySyncSummary;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<InventorySyncState['status'] | undefined>(
    initialStatus
  );
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [summary, setSummary] = useState<InventorySyncSummary | undefined>(
    initialSummary
  );
  const [errorCode, setErrorCode] = useState<string | undefined>();

  const runSync = () => {
    setErrorCode(undefined);
    setStatus('running');

    startTransition(async () => {
      try {
        const response = await fetch('/api/integrations/bling/inventory/sync', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        });
        const payload = (await response.json()) as SyncResponse;

        if (!response.ok || payload.status === 'error') {
          setStatus('error');
          setSummary(payload.summary);
          setErrorCode(payload.errorCode ?? payload.summary?.errorCode ?? 'sync_failed');
          return;
        }

        setStatus('success');
        setUpdatedAt(new Date().toISOString());
        setSummary(payload.summary);
      } catch {
        setStatus('error');
        setErrorCode('sync_failed');
      }
    });
  };

  const disabled = !canRun || isPending || status === 'running';
  const errorMessage = errorCode
    ? safeErrorLabel[errorCode] ?? 'Falha segura ao sincronizar estoque.'
    : undefined;

  return (
    <section className="rounded-xl border border-white/8 bg-[#0A1730]/95 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Sincronização de estoque</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Atualiza apenas saldos das variantes Bling já vinculadas ao catálogo.
          </p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {status ?? 'sem sync'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Processadas" value={summary?.variantsProcessed ?? 0} />
        <Metric label="Atualizadas" value={summary?.variantsUpdated ?? 0} />
        <Metric label="Puladas" value={summary?.variantsSkipped ?? 0} />
        <Metric label="Erros" value={summary?.errors ?? 0} />
      </div>

      <div className="mt-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs text-slate-400">
        Último estoque:{' '}
        <span className="font-semibold text-slate-200">
          {summary?.finishedAt ?? updatedAt ?? 'Não executado'}
        </span>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={runSync}
        disabled={disabled}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500 disabled:hover:bg-white/5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
        {isPending || status === 'running' ? 'Sincronizando...' : 'Sincronizar estoque'}
      </button>

      {summary?.diagnostics?.length ? (
        <div className="mt-4 rounded-lg border border-white/6 bg-[#081225]">
          <div className="border-b border-white/6 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Estoque recente
          </div>
          <div className="divide-y divide-white/6">
            {summary.diagnostics.slice(-5).map((item, index) => (
              <div
                key={`${item.externalId ?? 'estoque'}-${index}`}
                className="px-3 py-2 text-xs text-slate-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-200">
                    SKU {item.sku ?? item.externalId ?? '-'}
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                    {item.action ?? 'ok'}
                  </span>
                </div>
                <div className="mt-1 text-[11px]">
                  {item.previousStock ?? '-'} → {item.nextStock ?? '-'} un.
                </div>
                {item.errorCode ? (
                  <div className="mt-1 text-[11px] text-rose-200">
                    Erro: {item.errorCode}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!canRun ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Conecte o Bling via OAuth antes de sincronizar estoque.
        </p>
      ) : null}
    </section>
  );
}
