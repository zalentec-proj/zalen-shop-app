'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  FileText,
  KeyRound,
  Mail,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
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
  const [customerType, setCustomerType] = useState<'pf' | 'pj'>(
    state.registration?.customerType ?? 'pf'
  );

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
              <input type="hidden" name="mode" value={mode} />
              <input
                type="hidden"
                name="intent"
                value={isCodeStep ? 'verify' : 'request'}
              />

              {isCodeStep ? (
                <>
                  <input type="hidden" name="email" value={state.email} />
                  <input
                    type="hidden"
                    name="customerType"
                    value={state.registration?.customerType ?? 'pf'}
                  />
                  <input
                    type="hidden"
                    name="name"
                    value={state.registration?.name ?? ''}
                  />
                  <input
                    type="hidden"
                    name="document"
                    value={state.registration?.document ?? ''}
                  />
                  <input
                    type="hidden"
                    name="legalName"
                    value={state.registration?.legalName ?? ''}
                  />
                  <input
                    type="hidden"
                    name="stateRegistration"
                    value={state.registration?.stateRegistration ?? ''}
                  />
                  {state.registration?.stateRegistrationExempt ? (
                    <input
                      type="hidden"
                      name="stateRegistrationExempt"
                      value="on"
                    />
                  ) : null}
                  <Field
                    icon={KeyRound}
                    name="token"
                    placeholder="Código de acesso"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />
                </>
              ) : (
                <>
                  {isSignup ? (
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-brand-border-soft bg-[#050A14]/85 p-1">
                      {(['pf', 'pj'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={customerType === type}
                          onClick={() => setCustomerType(type)}
                          className={`h-10 rounded-lg text-xs font-bold transition ${
                            customerType === type
                              ? 'bg-blue-primary text-white'
                              : 'text-brand-muted hover:text-white'
                          }`}
                        >
                          {type === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
                        </button>
                      ))}
                      <input
                        type="hidden"
                        name="customerType"
                        value={customerType}
                      />
                    </div>
                  ) : null}

                  {isSignup && customerType === 'pj' ? (
                    <>
                      <Field
                        icon={UserRound}
                        name="name"
                        placeholder="Nome do responsável"
                        autoComplete="name"
                      />
                      <Field
                        icon={Building2}
                        name="document"
                        placeholder="CNPJ"
                        inputMode="numeric"
                      />
                      <Field
                        icon={Building2}
                        name="legalName"
                        placeholder="Razão social"
                        autoComplete="organization"
                      />
                      <Field
                        icon={FileText}
                        name="stateRegistration"
                        placeholder="Inscrição estadual"
                      />
                      <label className="flex items-center gap-2 rounded-xl border border-brand-border-soft bg-[#050A14]/85 px-3 py-3 text-xs font-semibold text-brand-muted">
                        <input
                          type="checkbox"
                          name="stateRegistrationExempt"
                          className="h-4 w-4 accent-blue-primary"
                        />
                        Empresa isenta de inscrição estadual
                      </label>
                    </>
                  ) : null}

                  <Field
                    icon={Mail}
                    name="email"
                    type="email"
                    placeholder="E-mail"
                    autoComplete="email"
                  />
                </>
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
        aria-label={placeholder}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="h-12 w-full rounded-xl border border-brand-border-soft bg-[#050A14]/85 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-brand-muted focus:border-blue-primary/70"
      />
    </label>
  );
}
