'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { platformBrand } from '@/lib/branding/platform-brand';
import { updatePasswordAction } from '../actions';

type FormActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

const initialState: FormActionState = {
  status: 'idle',
  message: null,
};

export default function UpdatePasswordClient({
  canUpdate,
  email,
}: {
  canUpdate: boolean;
  email?: string;
}) {
  const [state, formAction] = useActionState(updatePasswordAction, initialState);

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

          <h1 className="font-display text-3xl font-medium tracking-[-0.03em] text-white">
            Definir nova senha
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {canUpdate
              ? `Atualize a senha da conta ${email ?? 'autenticada'}.`
              : 'O link está expirado ou a sessão de recuperação não foi criada.'}
          </p>

          {canUpdate ? (
            <form action={formAction} className="mt-8 space-y-5">
              <label htmlFor="password" className="block space-y-2">
                <span className="text-sm font-medium text-white">Nova senha</span>
                <span className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 text-slate-300 transition focus-within:border-blue-primary/70 focus-within:bg-black/30 focus-within:ring-2 focus-within:ring-blue-primary/15">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    required
                    minLength={8}
                  />
                </span>
              </label>

              <label htmlFor="passwordConfirmation" className="block space-y-2">
                <span className="text-sm font-medium text-white">Confirmar senha</span>
                <span className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 text-slate-300 transition focus-within:border-blue-primary/70 focus-within:bg-black/30 focus-within:ring-2 focus-within:ring-blue-primary/15">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    required
                    minLength={8}
                  />
                </span>
              </label>

              {state.message ? (
                <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {state.message}
                </p>
              ) : null}

              <button
                type="submit"
                className="group flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-blue-primary via-[#2f68ff] to-[#4c66ff] px-5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(30,61,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(30,61,255,0.36)]"
              >
                Atualizar senha
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          ) : (
            <div className="mt-8 space-y-3">
              <Link
                href="/login/forgot"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-blue-primary px-4 text-sm font-semibold text-white transition hover:bg-[#2f68ff]"
              >
                Solicitar novo link
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Voltar ao login
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
