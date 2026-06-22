'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Lock, Mail, UserRound, Phone, BadgeCheck } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import type { CustomerAuthState } from './actions';
import { customerLoginAction, customerSignupAction } from './actions';

type Mode = 'login' | 'signup';

interface CustomerAuthFormProps {
  mode: Mode;
  nextPath: string;
}

const initialState: CustomerAuthState = {};

export default function CustomerAuthForm({
  mode,
  nextPath,
}: CustomerAuthFormProps) {
  const action = mode === 'login' ? customerLoginAction : customerSignupAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const isSignup = mode === 'signup';

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-10 text-white">
      <div className="absolute left-[10%] top-[10%] -z-10 h-[420px] w-[420px] rounded-full glow-radial opacity-40" />
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[32px] border border-brand-border bg-[#090E17]/90 shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden border-r border-brand-border-soft bg-white/[0.02] p-8 md:flex md:flex-col md:justify-between">
            <Link href="/" className="inline-flex">
              <Logo size="md" />
            </Link>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-primary">
                Conta do comprador
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white font-display">
                Finalize pedidos com dados salvos e histórico organizado.
              </h1>
              <p className="mt-4 text-sm leading-6 text-brand-muted">
                A conta pertence à loja Brasil Drones. O painel administrativo da Zalen continua separado.
              </p>
            </div>
            <div className="grid gap-3 text-xs text-brand-muted">
              {['Carrinho real persistido', 'Pedido salvo no Supabase', 'Integração ERP server-side'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-green-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8 md:p-10">
            <Link href="/" className="mb-8 inline-flex md:hidden">
              <Logo size="sm" />
            </Link>
            <div className="mb-7">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-green-accent">
                {isSignup ? 'Criar acesso' : 'Entrar na conta'}
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white font-display">
                {isSignup ? 'Crie sua conta para comprar' : 'Acesse para finalizar a compra'}
              </h2>
              <p className="mt-2 text-sm text-brand-muted">
                {isSignup
                  ? 'Usaremos esses dados para registrar o comprador no pedido.'
                  : 'Depois do login, você volta para o carrinho automaticamente.'}
              </p>
            </div>

            <form action={formAction} className="grid gap-3">
              <input type="hidden" name="next" value={nextPath} />

              {isSignup ? (
                <>
                  <Field icon={UserRound} name="name" placeholder="Nome completo" autoComplete="name" />
                  <Field icon={Phone} name="phone" placeholder="WhatsApp" autoComplete="tel" />
                  <Field icon={BadgeCheck} name="document" placeholder="CPF ou CNPJ" autoComplete="off" />
                </>
              ) : null}

              <Field icon={Mail} name="email" type="email" placeholder="E-mail" autoComplete="email" />
              <Field icon={Lock} name="password" type="password" placeholder="Senha" autoComplete={isSignup ? 'new-password' : 'current-password'} />

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
                  : isSignup
                    ? 'Criar conta'
                    : 'Entrar e continuar'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4 text-center text-sm text-brand-muted">
              {isSignup ? (
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
}: {
  icon: typeof UserRound;
  name: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-xl border border-brand-border-soft bg-[#050A14]/85 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-brand-muted focus:border-blue-primary/70"
      />
    </label>
  );
}
