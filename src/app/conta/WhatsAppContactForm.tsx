'use client';

import { useActionState, useState } from 'react';
import { updateWhatsAppContactAction, type WhatsAppContactState } from './actions';

const initialState: WhatsAppContactState = { step: 'phone' };

function formatBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, '');

  // A pessoa pode colar um número com +55. Para números nacionais, o DDD 55
  // continua válido porque só removemos o país quando existem mais de 11 dígitos.
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function WhatsAppContactForm() {
  const [state, action, pending] = useActionState(updateWhatsAppContactAction, initialState);
  const [phone, setPhone] = useState(() => formatBrazilianPhone(state.phone ?? ''));

  return <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5"><h2 className="text-lg font-black">WhatsApp</h2><p className="mt-1 text-sm text-brand-muted">Confirme seu número e escolha se deseja receber atualizações transacionais dos seus pedidos.</p><form action={action} className="mt-4 space-y-3">{state.step === 'code' ? <><input type="hidden" name="phone" value={state.phone ?? ''} /><input name="code" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="Código de 6 dígitos" className="w-full rounded-xl border border-brand-border bg-black/20 px-3 py-2 text-white" /><input type="hidden" name="intent" value="confirm" /></> : <><input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))} placeholder="(00) 00000-0000" aria-label="Número do WhatsApp" className="w-full rounded-xl border border-brand-border bg-black/20 px-3 py-2 text-white" /><input type="hidden" name="intent" value="request" /></>}<label className="flex gap-2 text-xs text-brand-muted"><input type="checkbox" name="optedIn" defaultChecked /> Quero receber por WhatsApp códigos de acesso e atualizações transacionais de pedidos.</label>{state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}{state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}<button disabled={pending} className="rounded-xl bg-blue-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{state.step === 'code' ? 'Confirmar WhatsApp' : 'Enviar código pelo WhatsApp'}</button></form></section>;
}
