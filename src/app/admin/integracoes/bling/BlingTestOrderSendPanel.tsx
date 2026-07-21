'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FlaskConical } from 'lucide-react';

const confirmationText = 'HOMOLOGAR NO BLING';

const errorMessages: Record<string, string> = {
  invalid_order_reference: 'Informe o número do pedido (ex.: BD-167498) ou o UUID completo.',
  order_not_found: 'Pedido não encontrado nesta loja. Confira o número exibido no admin.',
  order_payment_not_approved: 'O pedido existe, mas o pagamento ainda não está aprovado.',
  order_already_synced: 'Este pedido já foi enviado ao Bling.',
  order_send_already_running: 'Este pedido já está sendo enviado. Aguarde e atualize a página.',
};

type SendResult = {
  status?: 'success' | 'error' | 'skipped';
  orderNumber?: string;
  externalId?: string;
  errorCode?: string;
};

export function BlingTestOrderSendPanel({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orderId, setOrderId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<SendResult>();

  const canSubmit = canRun && confirmed && orderId.trim().length > 0 && !isPending;

  function submit() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      setResult(undefined);

      try {
        const response = await fetch('/api/integrations/bling/orders/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            orderId: orderId.trim(),
            mode: 'homologation',
            confirmation: confirmationText,
          }),
        });
        const payload = (await response.json()) as SendResult;

        setResult(payload);
        router.refresh();
      } catch {
        setResult({ status: 'error', errorCode: 'homologation_request_failed' });
      }
    });
  }

  return (
    <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
      <FlaskConical className="h-5 w-5 text-amber-200" />
      <h2 className="mt-3 text-base font-semibold">Enviar um pedido de homologação</h2>
      <p className="mt-1 text-xs leading-5 text-slate-300">
        Envio único e manual para a conta Bling conectada. Esta ação não altera a
        trava automática. O pedido precisa estar pago e seus SKUs precisam existir
        no Bling.
      </p>
      <p className="mt-2 text-xs font-semibold text-amber-100">
        O Bling receberá a observação: “NÃO FATURAR, NÃO EXPEDIR”. Cancele o pedido após validar.
      </p>

      <label className="mt-4 block text-xs font-semibold text-slate-200" htmlFor="bling-test-order-id">
        Número ou ID do pedido pago na Zalen
      </label>
      <input
        id="bling-test-order-id"
        value={orderId}
        onChange={(event) => setOrderId(event.target.value)}
        placeholder="Ex.: BD-167498"
        autoComplete="off"
        className="mt-2 w-full rounded-lg border border-white/10 bg-[#081225] px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-300/50"
      />

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-3.5 w-3.5 accent-amber-400"
        />
        Confirmo que este é um pedido de teste e que a criação no Bling real é intencional.
      </label>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="mt-4 w-full rounded-lg border border-amber-300/30 bg-amber-300/15 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
      >
        {isPending ? 'Enviando homologação…' : 'Enviar somente este pedido'}
      </button>

      {!canRun ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Disponível apenas para owner/admin quando o Bling estiver conectado com criptografia ativa.
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-[#081225] px-3 py-2 text-xs text-slate-200">
          {result.status === 'success'
            ? `Pedido ${result.orderNumber ?? ''} enviado ao Bling (ID ${result.externalId ?? 'não informado'}).`
            : errorMessages[result.errorCode ?? ''] ??
              `Envio não concluído: ${result.errorCode ?? 'erro_controlado'}.`}
        </div>
      ) : null}
    </section>
  );
}
