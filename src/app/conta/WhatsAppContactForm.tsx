'use client';

import { useActionState } from 'react';
import { updateWhatsAppContactAction, type WhatsAppContactState } from './actions';

const initialState: WhatsAppContactState = { step: 'phone' };

export default function WhatsAppContactForm() {
  const [state, action, pending] = useActionState(updateWhatsAppContactAction, initialState);
  return <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5"><h2 className="text-lg font-black">WhatsApp</h2><p className="mt-1 text-sm text-brand-muted">Confirme seu número e escolha se deseja receber atualizações transacionais dos seus pedidos.</p><form action={action} className="mt-4 space-y-3">{state.step === 'code' ? <><input type="hidden" name="phone" value={state.phone ?? ''} /><input name="code" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" className="w-full rounded-xl border border-brand-border bg-black/20 px-3 py-2 text-white" /><input type="hidden" name="intent" value="confirm" /></> : <><input name="phone" type="tel" defaultValue={state.phone} placeholder="+55 (00) 00000-0000" className="w-full rounded-xl border border-brand-border bg-black/20 px-3 py-2 text-white" /><input type="hidden" name="intent" value="request" /></>}<label className="flex gap-2 text-xs text-brand-muted"><input type="checkbox" name="optedIn" defaultChecked /> Quero receber por WhatsApp códigos de acesso e atualizações transacionais de pedidos.</label>{state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}{state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}<button disabled={pending} className="rounded-xl bg-blue-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{state.step === 'code' ? 'Confirmar WhatsApp' : 'Enviar código pelo WhatsApp'}</button></form></section>;
}
