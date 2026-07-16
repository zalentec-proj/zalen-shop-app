'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { KeyRound, Mail, type LucideIcon } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import type { CustomerAuthState } from './actions';
import { customerOtpAction } from './actions';

type Mode = 'login' | 'signup';

interface CustomerAuthFormProps {
  mode: Mode;
  nextPath: string;
}

const initialState: CustomerAuthState = {
  step: 'email',
};

export default function CustomerAuthForm({
  mode,
  nextPath,
}: CustomerAuthFormProps) {
  const [state, formAction, isPending] = useActionState(
    customerOtpAction,
    initialState
  );
  const isSignup = mode === 'signup';
  const isCodeStep = state.step === 'code' && state.email;

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 text-white sm:py-12">
      <div className="absolute left-[10%] top-[10%] -z-10 h-[420px] w-[420px] rounded-full glow-radial opacity-40" />
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-brand-border bg-[#090E17]/90 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.6)] sm:p-8">
          <Link href="/" className="mb-10 inline-flex">
            <Logo size="sm" />
          </Link>
          <div className="mb-7">
            <h1 className="text-2xl font-black tracking-tight text-white font-display">
              {isCodeStep
                ? 'Digite o código recebido'
                : isSignup
                  ? 'Crie sua conta'
                  : 'Acesse sua conta'}
            </h1>
            <p className="mt-2 text-sm text-brand-muted">
              {isCodeStep
                ? `Enviamos um código para ${state.email}.`
                : 'Informe seu e-mail para receber o código de acesso.'}
            </p>
          </div>

          <form action={formAction} className="grid gap-3">
              <input type="hidden" name="next" value={nextPath} />
              <input
                type="hidden"
                name="intent"
                value={isCodeStep ? 'verify' : 'request'}
              />

              {isCodeStep ? (
                <>
                  <input type="hidden" name="email" value={state.email} />
                  <Field
                    icon={KeyRound}
                    name="token"
                    placeholder="Código de acesso"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />
                </>
              ) : (
                <Field
                  icon={Mail}
                  name="email"
                  type="email"
                  placeholder="E-mail"
                  autoComplete="email"
                />
              )}

              {state.error ? (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                  {state.error}
                </p>
              ) : null}

              {state.message ? (
                <p className="rounded-xl border border-green-accent/20 bg-green-accent/10 px-3 py-2 text-xs font-semibold text-green-accent">
                  {state.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="mt-2 h-12 rounded-xl bg-blue-primary text-sm font-bold text-white shadow-[0_10px_28px_rgba(30,61,255,0.35)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? 'Processando...'
                  : isCodeStep
                    ? 'Verificar código'
                    : 'Receber código'}
              </button>
          </form>

          <div className="mt-6 border-t border-brand-border-soft pt-5 text-center text-sm text-brand-muted">
              {isCodeStep ? (
                <>
                  Não recebeu?{' '}
                  <Link href={`/conta/entrar?next=${encodeURIComponent(nextPath)}`} className="font-bold text-blue-primary hover:underline">
                    Solicitar novo código
                  </Link>
                </>
              ) : isSignup ? (
                <>
                  Já tem conta?{' '}
                  <Link href={`/conta/entrar?next=${encodeURIComponent(nextPath)}`} className="font-bold text-blue-primary hover:underline">
                    Entrar
                  </Link>
                </>
              ) : (
                <>
                  Ainda não tem conta?{' '}
                  <Link href={`/conta/cadastro?next=${encodeURIComponent(nextPath)}`} className="font-bold text-blue-primary hover:underline">
                    Criar cadastro
                  </Link>
                </>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  icon: Icon,
  name,
  placeholder,
  type = 'text',
  autoComplete,
  inputMode,
}: {
  icon: LucideIcon;
  name: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric';
}) {
  return (
    <label className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="h-12 w-full rounded-xl border border-brand-border-soft bg-[#050A14]/85 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-brand-muted focus:border-blue-primary/70"
      />
    </label>
  );
}
