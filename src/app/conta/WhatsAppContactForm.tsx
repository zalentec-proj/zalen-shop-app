'use client';

import { useActionState, useEffect, useState } from 'react';
import { formatBrazilianPhone } from '@/lib/phone/brazilian-phone';
import {
  updateWhatsAppContactAction,
  type WhatsAppContactState,
} from './actions';

export default function WhatsAppContactForm({
  initialPhone,
  initialVerified = false,
  initialOptedIn = false,
}: {
  initialPhone?: string;
  initialVerified?: boolean;
  initialOptedIn?: boolean;
}) {
  const initialState: WhatsAppContactState = {
    step: initialVerified ? 'verified' : 'phone',
    phone: initialPhone,
    verified: initialVerified,
    optedIn: initialOptedIn,
  };
  const [state, action, pending] = useActionState(
    updateWhatsAppContactAction,
    initialState
  );
  const [phone, setPhone] = useState(() =>
    formatBrazilianPhone(initialPhone ?? '')
  );
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [editingPhone, setEditingPhone] = useState(false);
  const step = editingPhone ? 'phone' : state.step ?? 'phone';

  useEffect(() => {
    if (typeof state.optedIn === 'boolean') setOptedIn(state.optedIn);
    if (state.phone) setPhone(formatBrazilianPhone(state.phone));
  }, [state.optedIn, state.phone]);

  return (
    <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
      <h2 className="text-lg font-black">WhatsApp</h2>
      <p className="mt-1 text-sm leading-6 text-brand-muted">
        Confirme seu número para receber o mesmo código de acesso do e-mail e,
        se desejar, atualizações dos pedidos.
      </p>

      <form action={action} className="mt-4 space-y-3">
        {step === 'verified' ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
              Número confirmado
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatBrazilianPhone(state.phone ?? initialPhone ?? '')}
            </p>
          </div>
        ) : step === 'code' ? (
          <>
            <input type="hidden" name="phone" value={state.phone ?? phone} />
            <p className="text-xs text-brand-muted">
              Código enviado para {formatBrazilianPhone(state.phone ?? phone)}.
              Ele expira em 10 minutos.
            </p>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              aria-label="Código de confirmação do WhatsApp"
              className="w-full rounded-xl border border-brand-border bg-black/20 px-3 py-2 text-center font-bold tracking-[0.2em] text-white"
            />
          </>
        ) : (
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(event) =>
              setPhone(formatBrazilianPhone(event.target.value))
            }
            placeholder="(00) 00000-0000"
            aria-label="Número do WhatsApp"
            className="w-full rounded-xl border border-brand-border bg-black/20 px-3 py-2 text-white"
          />
        )}

        <label className="flex items-start gap-2 text-xs leading-5 text-brand-muted">
          <input
            type="checkbox"
            name="optedIn"
            checked={optedIn}
            onChange={(event) => setOptedIn(event.target.checked)}
            className="mt-1"
          />
          Quero receber por WhatsApp códigos de acesso e atualizações
          transacionais dos meus pedidos. Posso desativar a qualquer momento.
        </label>

        {state.error ? (
          <p role="alert" className="text-sm text-rose-300">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-sm text-emerald-300">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            name="intent"
            value={step === 'verified' ? 'preferences' : step === 'code' ? 'confirm' : 'request'}
            disabled={pending || (step === 'phone' && phone.length < 14)}
            onClick={() => setEditingPhone(false)}
            className="rounded-xl bg-blue-primary px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? 'Aguarde...'
              : step === 'verified'
                ? 'Salvar preferência'
                : step === 'code'
                ? 'Confirmar WhatsApp'
                : 'Enviar código pelo WhatsApp'}
          </button>

          {step === 'verified' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPhone('');
                setEditingPhone(true);
              }}
              className="rounded-xl border border-brand-border px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Trocar número
            </button>
          ) : step === 'code' ? (
            <>
              <button
                name="intent"
                value="request"
                disabled={pending}
                className="rounded-xl border border-brand-border px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Reenviar código
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditingPhone(true)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-brand-muted transition hover:text-white disabled:opacity-50"
              >
                Alterar número
              </button>
            </>
          ) : null}
        </div>
      </form>
    </section>
  );
}
