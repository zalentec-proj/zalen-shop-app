'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck } from 'lucide-react';

type Step = {
  key?: string;
  status?: 'pending' | 'success' | 'error';
  statusCode?: number;
  errorCode?: string;
};

type HomologationResult = {
  status?: 'success' | 'error';
  durationMs?: number;
  tokenRefreshed?: boolean;
  productId?: number;
  errorCode?: string;
  steps?: Step[];
};

type Props = {
  canRun: boolean;
  initialStatus?: 'running' | 'success' | 'error';
  initialSummary?: HomologationResult;
};

const stepLabels: Record<string, string> = {
  get_product: 'GET produtos',
  post_product: 'POST produto',
  put_product: 'PUT produto',
  patch_product_situation: 'PATCH situação',
  delete_product: 'DELETE produto',
};

const expectedSteps = [
  'get_product',
  'post_product',
  'put_product',
  'patch_product_situation',
  'delete_product',
];

function getStatusClass(status: Step['status']) {
  if (status === 'success') {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
  }

  if (status === 'error') {
    return 'border-rose-400/20 bg-rose-400/10 text-rose-200';
  }

  return 'border-white/8 bg-white/5 text-slate-400';
}

export function BlingHomologationPanel({
  canRun,
  initialStatus,
  initialSummary,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Props['initialStatus']>(
    initialStatus ?? 'error'
  );
  const [summary, setSummary] = useState<HomologationResult | undefined>(
    initialSummary
  );

  function runHomologation() {
    startTransition(async () => {
      setStatus('running');

      try {
        const response = await fetch('/api/integrations/bling/homologation/run', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        });
        const payload = (await response.json()) as HomologationResult;

        setSummary(payload);
        setStatus(payload.status === 'success' ? 'success' : 'error');
      } catch {
        setSummary({
          status: 'error',
          errorCode: 'homologation_request_failed',
        });
        setStatus('error');
      }
    });
  }

  const stepsByKey = new Map(summary?.steps?.map((step) => [step.key, step]));

  return (
    <section className="rounded-xl border border-white/8 bg-[#0A1730]/95 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Homologação</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Executa a sequência oficial da API Bling no servidor, sem expor tokens.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
            status === 'running' ? 'pending' : status
          )}`}
        >
          {status === 'success'
            ? 'Sucesso'
            : status === 'running'
              ? 'Executando'
              : 'Pendente/erro'}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {expectedSteps.map((key) => {
          const step = stepsByKey.get(key);

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs"
            >
              <span className="font-semibold text-slate-200">{stepLabels[key]}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClass(
                  step?.status ?? 'pending'
                )}`}
              >
                {step?.status === 'success'
                  ? 'sucesso'
                  : step?.status === 'error'
                    ? 'erro'
                    : 'pendente'}
              </span>
            </div>
          );
        })}
      </div>

      {summary?.errorCode ? (
        <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          Falha controlada: {summary.errorCode}
        </div>
      ) : null}

      {summary?.durationMs ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Duração: {summary.durationMs}ms
          {summary.tokenRefreshed ? ' · token renovado durante o teste' : ''}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canRun || isPending || status === 'running'}
        onClick={runHomologation}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500 disabled:hover:brightness-100"
      >
        Executar homologação
        <ShieldCheck className="h-4 w-4" />
      </button>

      {!canRun ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Conecte o Bling via OAuth antes de executar a homologação.
        </p>
      ) : null}
    </section>
  );
}
