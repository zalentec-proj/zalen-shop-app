'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import type { BlingAdminState } from '@/modules/integrations/bling/bling.types';

type ProductSyncState = NonNullable<BlingAdminState['productSync']>;
type ProductSyncSummary = NonNullable<ProductSyncState['summary']>;

type SyncResponse = {
  status: 'success' | 'error';
  summary?: ProductSyncSummary;
  errorCode?: string;
};

const syncLockRetryLimit = 20;
const syncLockRetryDelayMs = 3_000;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mergeSyncSummaries(
  current: ProductSyncSummary | undefined,
  next: ProductSyncSummary
): ProductSyncSummary {
  if (!current) {
    return next;
  }

  const sum = (left: number | undefined, right: number | undefined) =>
    (left ?? 0) + (right ?? 0);

  return {
    ...next,
    startedAt: current.startedAt ?? next.startedAt,
    durationMs: sum(current.durationMs, next.durationMs),
    pagesProcessed: sum(current.pagesProcessed, next.pagesProcessed),
    productsProcessed: sum(current.productsProcessed, next.productsProcessed),
    productsCreated: sum(current.productsCreated, next.productsCreated),
    productsUpdated: sum(current.productsUpdated, next.productsUpdated),
    productsSkipped: sum(current.productsSkipped, next.productsSkipped),
    categoriesSynced: next.categoriesSynced,
    categoriesLinked: sum(current.categoriesLinked, next.categoriesLinked),
    categoriesCreated: sum(current.categoriesCreated, next.categoriesCreated),
    categoriesSkipped: sum(current.categoriesSkipped, next.categoriesSkipped),
    errors: sum(current.errors, next.errors),
    variantsProcessed: sum(current.variantsProcessed, next.variantsProcessed),
    stockBalancesSynced: sum(
      current.stockBalancesSynced,
      next.stockBalancesSynced
    ),
    diagnostics: [
      ...(current.diagnostics ?? []),
      ...(next.diagnostics ?? []),
    ].slice(-30),
  };
}

const safeErrorLabel: Record<string, string> = {
  access_denied: 'Sua conta não possui acesso à loja ativa.',
  bling_not_connected: 'Conecte o Bling antes de sincronizar o catálogo.',
  invalid_bling_credentials: 'Credenciais Bling inválidas. Reconecte a integração.',
  missing_session: 'Sessão expirada. Faça login novamente.',
  product_sync_already_running: 'Já existe uma sincronização em andamento.',
};

function ActionBadge({ action }: { action?: string }) {
  const className =
    action === 'error'
      ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
      : action === 'created'
        ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
        : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${className}`}>
      {action ?? 'ok'}
    </span>
  );
}

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

export function BlingProductSyncPanel({
  canRun,
  initialStatus,
  initialUpdatedAt,
  initialSummary,
}: {
  canRun: boolean;
  initialStatus?: ProductSyncState['status'];
  initialUpdatedAt?: string;
  initialSummary?: ProductSyncSummary;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ProductSyncState['status'] | undefined>(
    initialStatus
  );
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [summary, setSummary] = useState<ProductSyncSummary | undefined>(
    initialSummary
  );
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [manualProductId, setManualProductId] = useState('');

  const runSync = (
    mode: 'incremental' | 'full' = 'incremental',
    productId?: string
  ) => {
    setErrorCode(undefined);
    setStatus('running');

    startTransition(async () => {
      try {
        let page = !productId ? 1 : undefined;
        let accumulatedSummary: ProductSyncSummary | undefined;
        let lockRetries = 0;

        while (true) {
          const response = await fetch('/api/integrations/bling/products/sync', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode, productId, page }),
          });
          const payload = (await response.json()) as SyncResponse;

          if (
            payload.errorCode === 'product_sync_already_running' &&
            lockRetries < syncLockRetryLimit
          ) {
            lockRetries += 1;
            await wait(syncLockRetryDelayMs);
            continue;
          }

          if (!response.ok || payload.status === 'error' || !payload.summary) {
            setStatus('error');
            setSummary(
              payload.summary
                ? mergeSyncSummaries(accumulatedSummary, payload.summary)
                : accumulatedSummary
            );
            setErrorCode(
              payload.errorCode ?? payload.summary?.errorCode ?? 'sync_failed'
            );
            return;
          }

          accumulatedSummary = mergeSyncSummaries(
            accumulatedSummary,
            payload.summary
          );
          lockRetries = 0;
          setSummary(accumulatedSummary);

          if (!page || payload.summary.hasMore !== true) {
            break;
          }

          page += 1;
        }

        setStatus('success');
        setUpdatedAt(new Date().toISOString());
      } catch {
        setStatus('error');
        setErrorCode('sync_failed');
      }
    });
  };

  const disabled = !canRun || isPending || status === 'running';
  const errorMessage = errorCode
    ? safeErrorLabel[errorCode] ?? 'Falha segura ao sincronizar produtos.'
    : undefined;

  return (
    <section className="rounded-xl border border-white/8 bg-[#0A1730]/95 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Sincronização de catálogo</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Busca produtos no Bling pelo servidor e salva no catálogo Supabase.
          </p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {status ?? 'sem sync'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Criados" value={summary?.productsCreated ?? 0} />
        <Metric label="Atualizados" value={summary?.productsUpdated ?? 0} />
        <Metric label="Variantes" value={summary?.variantsProcessed ?? 0} />
        <Metric label="Saldos" value={summary?.stockBalancesSynced ?? 0} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="Categorias ERP" value={summary?.categoriesSynced ?? 0} />
        <Metric label="Vínculos" value={summary?.categoriesLinked ?? 0} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="Criadas" value={summary?.categoriesCreated ?? 0} />
        <Metric label="Erros" value={summary?.errors ?? 0} />
      </div>

      <div className="mt-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs text-slate-400">
        Último sync:{' '}
        <span className="font-semibold text-slate-200">
          {summary?.finishedAt ?? updatedAt ?? 'Não executado'}
        </span>
        <span className="ml-2 rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">
          {summary?.syncMode === 'single'
            ? 'produto'
            : summary?.syncMode === 'incremental'
              ? 'incremental'
              : 'completo'}
        </span>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={() => runSync('incremental')}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500 disabled:hover:brightness-100"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending || status === 'running' ? 'Sincronizando...' : 'Sincronizar produtos'}
        </button>
        <button
          type="button"
          onClick={() => runSync('full')}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:border-white/10 disabled:hover:bg-white/5"
        >
          Reprocessar tudo
        </button>
      </div>

      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-1 text-[11px] text-slate-400">
          ID do produto no Bling
          <input
            type="text"
            inputMode="numeric"
            value={manualProductId}
            onChange={(event) =>
              setManualProductId(event.target.value.replace(/\D/g, ''))
            }
            placeholder="Ex.: 16690733656"
            className="min-h-9 rounded-lg border border-white/10 bg-[#081225] px-3 text-xs text-white outline-none transition focus:border-sky-400/50"
          />
        </label>
        <button
          type="button"
          onClick={() => runSync('full', manualProductId)}
          disabled={disabled || !/^\d+$/.test(manualProductId)}
          className="self-end rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          Reprocessar ID
        </button>
      </div>

      {!canRun ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Conecte o Bling via OAuth antes de sincronizar produtos.
        </p>
      ) : null}

      {summary?.diagnostics?.length ? (
        <div className="mt-4 rounded-lg border border-white/6 bg-[#081225]">
          <div className="border-b border-white/6 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Diagnóstico recente
          </div>
          <div className="divide-y divide-white/6">
            {summary.diagnostics.slice(-5).map((item, index) => (
              <div
                key={`${item.externalId ?? 'produto'}-${index}`}
                className="grid gap-1 px-3 py-2 text-xs text-slate-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-200">
                    {item.name ?? item.externalId ?? 'Produto Bling'}
                  </span>
                  <ActionBadge action={item.action} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span>ID: {item.externalId ?? '-'}</span>
                  <span>SKU: {item.sku ?? '-'}</span>
                  <span>Imagem: {item.imageFound ? 'sim' : 'não'}</span>
                  <span>Categoria: {item.category ?? '-'}</span>
                  <span>Estoque: {item.stockItems ?? 0}</span>
                </div>
                {item.errorCode ? (
                  <span className="text-[11px] text-rose-200">
                    Erro: {item.errorCode}
                  </span>
                ) : null}
                {item.externalId ? (
                  <button
                    type="button"
                    onClick={() => runSync('full', item.externalId)}
                    disabled={disabled}
                    className="mt-1 w-fit rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    Reprocessar produto
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
