'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { BlingAdminState } from '@/modules/integrations/bling/bling.types';

type WebhooksState = BlingAdminState['webhooks'];
type OrderSendState = BlingAdminState['orderSend'];

type ProcessResponse = {
  status: 'success' | 'error';
  summary?: {
    jobsClaimed?: number;
    jobsProcessed?: number;
    jobsSucceeded?: number;
    jobsFailed?: number;
    jobsSkipped?: number;
    productSyncs?: number;
    inventorySyncs?: number;
    productsInactivated?: number;
    errors?: number;
  };
  errorCode?: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const safeErrorLabel: Record<string, string> = {
  access_denied: 'Sua conta não possui acesso à loja ativa.',
  missing_session: 'Sessão expirada. Faça login novamente.',
  bling_webhook_process_partial_error:
    'Alguns eventos foram processados, mas ainda há pendências com erro.',
};

function formatOptionalDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return dateTimeFormatter.format(new Date(value));
}

function formatOrderSendStatus(status: OrderSendState['status']) {
  if (status === 'success') {
    return 'Sucesso';
  }

  if (status === 'error') {
    return 'Erro';
  }

  if (status === 'running') {
    return 'Em execução';
  }

  return 'Sem execução';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export function BlingWebhookProcessPanel({
  canRun,
  initialSummary,
  orderSend,
}: {
  canRun: boolean;
  initialSummary: WebhooksState;
  orderSend: OrderSendState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<ProcessResponse['summary']>();
  const [errorCode, setErrorCode] = useState<string>();

  const runProcess = () => {
    setErrorCode(undefined);

    startTransition(async () => {
      try {
        const response = await fetch('/api/integrations/bling/webhooks/process', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        });
        const payload = (await response.json()) as ProcessResponse;

        setLastResult(payload.summary);

        if (!response.ok || payload.status === 'error') {
          setErrorCode(payload.errorCode ?? 'bling_webhook_process_failed');
        }

        router.refresh();
      } catch {
        setErrorCode('bling_webhook_process_failed');
      }
    });
  };

  const errorMessage = errorCode
    ? safeErrorLabel[errorCode] ?? 'Falha segura ao processar webhooks.'
    : undefined;
  const disabled = !canRun || isPending;

  return (
    <section className="rounded-xl border border-white/8 bg-[#0A1730]/95 p-4">
      <ShieldCheck className="h-5 w-5 text-[#7EC3FF]" />
      <h2 className="mt-3 text-base font-semibold">Pedidos e webhooks</h2>

      <div className="mt-3 space-y-2 text-xs">
        <Row
          label="Trava de pedido"
          value={orderSend.enabled ? 'Ligada' : 'Desligada'}
        />
        <Row
          label="Último envio"
          value={formatOptionalDateTime(orderSend.updatedAt) ?? 'Sem envio'}
        />
        <Row label="Status do envio" value={formatOrderSendStatus(orderSend.status)} />
        <Row label="Webhooks recebidos" value={String(initialSummary.received)} />
        <Row label="Jobs pendentes" value={String(initialSummary.pending)} />
        <Row label="Erros" value={String(initialSummary.error)} />
        <Row
          label="Último webhook"
          value={
            formatOptionalDateTime(initialSummary.lastReceivedAt) ?? 'Sem webhook'
          }
        />
      </div>

      {lastResult ? (
        <div className="mt-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs text-slate-400">
          Último processamento:{' '}
          <span className="font-semibold text-white">
            {lastResult.jobsProcessed ?? 0} jobs
          </span>
          , {lastResult.productSyncs ?? 0} produtos,{' '}
          {lastResult.inventorySyncs ?? 0} estoques,{' '}
          {lastResult.productsInactivated ?? 0} inativados.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={runProcess}
        disabled={disabled}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/30 bg-[#1E3DFF]/12 px-3 py-2 text-xs font-semibold text-[#BFD6FF] transition hover:bg-[#1E3DFF]/18 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500 disabled:hover:bg-white/5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Processando...' : 'Processar pendências'}
      </button>
    </section>
  );
}
