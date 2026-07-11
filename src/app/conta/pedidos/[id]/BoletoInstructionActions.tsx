'use client';

import { Check, Copy, Download, ExternalLink, Printer } from 'lucide-react';
import { useState } from 'react';

type BoletoInstructionActionsProps = {
  orderNumber: string;
  total: string;
  paymentCode?: string;
  expiresAt?: string;
  ticketUrl?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };

    return entities[character];
  });
}

function createPrintableDocument(input: Required<
  Pick<BoletoInstructionActionsProps, 'orderNumber' | 'total'>
> &
  Omit<BoletoInstructionActionsProps, 'orderNumber' | 'total' | 'ticketUrl'>) {
  const expiresAt = input.expiresAt ? `<p>Vencimento: ${escapeHtml(input.expiresAt)}</p>` : '';
  const paymentCode = input.paymentCode
    ? `<section><p class="label">Codigo para pagamento</p><p class="code">${escapeHtml(input.paymentCode)}</p></section>`
    : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Boleto ${escapeHtml(input.orderNumber)}</title>
<style>body{font-family:Arial,sans-serif;color:#111827;margin:48px;max-width:720px}h1{font-size:28px;margin:0 0 8px}.muted{color:#4b5563}.label{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4b5563}.code{border:1px solid #d1d5db;background:#f9fafb;border-radius:8px;padding:16px;font:700 15px/1.6 monospace;letter-spacing:.04em;word-break:break-all}section{margin-top:28px}</style>
</head><body><h1>Boleto - pedido ${escapeHtml(input.orderNumber)}</h1><p class="muted">Total: ${escapeHtml(input.total)}</p>${expiresAt}${paymentCode}<p class="muted">Confira os dados antes de concluir o pagamento.</p></body></html>`;
}

export default function BoletoInstructionActions({
  orderNumber,
  total,
  paymentCode,
  expiresAt,
  ticketUrl,
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

  function getDocument() {
    return createPrintableDocument({
      orderNumber,
      total,
      paymentCode,
      expiresAt,
    });
  }

  function downloadInstructions() {
    const blob = new Blob([getDocument()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `boleto-${orderNumber}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printOrSavePdf() {
    const printWindow = window.open('', '_blank', 'width=900,height=720');

    if (!printWindow) {
      setActionError('O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
      return;
    }

    printWindow.opener = null;
    printWindow.document.write(getDocument());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
      {paymentCode ? (
        <button
          type="button"
          onClick={printOrSavePdf}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-black text-white transition hover:border-blue-primary/50"
        >
          <Printer className="h-4 w-4" />
          Imprimir / salvar PDF
        </button>
      ) : null}
      {paymentCode ? (
        <button
          type="button"
          onClick={downloadInstructions}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-black text-white transition hover:border-blue-primary/50"
        >
          <Download className="h-4 w-4" />
          Baixar instruções
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
          Abrir no Mercado Pago
        </a>
      ) : null}
      {actionError ? <p className="basis-full text-xs text-rose-300">{actionError}</p> : null}
    </div>
  );
}
