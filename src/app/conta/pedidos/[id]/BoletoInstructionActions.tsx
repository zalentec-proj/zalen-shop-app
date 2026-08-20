'use client';

import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

type BoletoInstructionActionsProps = {
  paymentCode?: string;
  ticketUrl?: string;
  method?: 'pix' | 'ticket';
};

export default function BoletoInstructionActions({
  paymentCode,
  ticketUrl,
  method = 'ticket',
}: BoletoInstructionActionsProps) {
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function copyPaymentCode() {
    if (!paymentCode) return;

    try {
      await navigator.clipboard.writeText(paymentCode);
      setCopied(true);
      setActionError(null);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.');
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {paymentCode ? (
        <button
          type="button"
          onClick={copyPaymentCode}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-primary px-4 text-xs font-black text-white transition hover:opacity-95"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Código copiado' : 'Copiar código'}
        </button>
      ) : null}
      {ticketUrl ? (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-black text-white transition hover:border-blue-primary/50"
        >
          <ExternalLink className="h-4 w-4" />
          {method === 'pix'
            ? 'Abrir Pix no Mercado Pago'
            : 'Abrir boleto oficial no Mercado Pago'}
        </a>
      ) : null}
      {actionError ? <p className="basis-full text-xs text-rose-300">{actionError}</p> : null}
    </div>
  );
}
