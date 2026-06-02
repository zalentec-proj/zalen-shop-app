'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useActionState } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { platformBrand } from '@/lib/branding/platform-brand';
import { requestPasswordResetAction } from '../actions';

type FormActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

const initialState: FormActionState = {
  status: 'idle',
  message: null,
};

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 text-slate-300 transition focus-within:border-blue-primary/70 focus-within:bg-black/30 focus-within:ring-2 focus-within:ring-blue-primary/15">
        <span className="text-slate-400">{icon}</span>
        {children}
      </span>
    </label>
  );
}

export default function ForgotPasswordClient() {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    initialState
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070D] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(30,61,255,0.18),transparent_34%),radial-gradient(circle_at_82%_84%,rgba(0,230,118,0.08),transparent_30%)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[760px] items-center justify-center overflow-hidden rounded-3xl border border-white/12 bg-[#080D14]/88 p-6 shadow-[0_28px_110px_rgba(0,0,0,0.58)] sm:p-10">
        <div className="w-full max-w-[430px]">
          <img
            src={platformBrand.logoWhite}
            alt={platformBrand.name}
            className="mb-10 h-14 w-auto max-w-[300px]"
          />

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>

          <h1 className="mt-8 font-display text-3xl font-medium tracking-[-0.03em] text-white">
            Recuperar senha
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Informe o e-mail da conta. Se ele existir na plataforma, enviaremos
            um link seguro para redefinição.
          </p>

          <form action={formAction} className="mt-8 space-y-5">
            <Field id="email" label="E-mail" icon={<Mail className="h-4 w-4" />}>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                required
              />
            </Field>

            {state.message ? (
              <p
                className={
                  state.status === 'success'
                    ? 'rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100'
                    : 'rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100'
                }
              >
                {state.message}
              </p>
            ) : null}

            <button
              type="submit"
              className="group flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-blue-primary via-[#2f68ff] to-[#4c66ff] px-5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(30,61,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(30,61,255,0.36)]"
            >
              Enviar link de recuperação
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
