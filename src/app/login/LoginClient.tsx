'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useActionState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Eye,
  Globe2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import { platformBrand } from '@/lib/branding/platform-brand';
import { loginAction } from './actions';

type LoginActionState = {
  error: string | null;
};

const initialLoginState: LoginActionState = {
  error: null,
};

function SubmitButton() {
  return (
    <button
      type="submit"
      className="group mt-2 flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-blue-primary via-[#2f68ff] to-[#4c66ff] px-5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(30,61,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(30,61,255,0.36)] focus:outline-none focus:ring-2 focus:ring-blue-primary/60 focus:ring-offset-2 focus:ring-offset-[#070B12]"
    >
      Entrar na plataforma
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </button>
  );
}

function TextInput({
  id,
  label,
  type,
  name,
  placeholder,
  icon,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  name: string;
  placeholder: string;
  icon: ReactNode;
  autoComplete: string;
}) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 text-slate-300 transition focus-within:border-blue-primary/70 focus-within:bg-black/30 focus-within:ring-2 focus-within:ring-blue-primary/15">
        <span className="text-slate-400">{icon}</span>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          required
        />
        {type === 'password' ? (
          <Eye className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        ) : null}
      </span>
    </label>
  );
}

export default function LoginClient({ nextPath = '/admin' }: { nextPath?: string }) {
  const [state, formAction] = useActionState(loginAction, initialLoginState);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070D] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(30,61,255,0.18),transparent_34%),radial-gradient(circle_at_82%_84%,rgba(0,230,118,0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1530px] overflow-hidden rounded-3xl border border-white/12 bg-[#080D14]/88 shadow-[0_28px_110px_rgba(0,0,0,0.58)] lg:min-h-[780px] lg:grid-cols-[1fr_1fr]">
        <div
          className="relative hidden overflow-hidden border-r border-white/10 bg-cover bg-center lg:block"
          style={{
            backgroundImage: `url(${platformBrand.loginBackground})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#02060C]/54 via-[#060B14]/38 to-[#02060C]/76" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_55%,rgba(30,61,255,0.2),transparent_32%),linear-gradient(90deg,rgba(0,0,0,0.12),rgba(0,0,0,0.44))]" />

          <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-14">
            <div />

            <div className="max-w-[420px]">
              <p className="font-mono text-[clamp(1.65rem,2.5vw,2.35rem)] font-semibold uppercase leading-[1.08] tracking-[0.08em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.08)]">
                Tecnologia
                <br />
                que conecta.
                <br />
                <span className="text-blue-400">Gestão que transforma.</span>
              </p>
              <p className="mt-8 max-w-[310px] text-base leading-7 text-slate-300">
                Zalen.Shop é a plataforma completa para você gerenciar suas
                lojas, produtos, pedidos e integrações em um só lugar.
              </p>
            </div>

            <div className="max-w-[310px] rounded-xl border border-white/10 bg-black/24 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.36)] backdrop-blur-md">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/35 bg-blue-primary/10 text-blue-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Plataforma segura e confiável
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-400">
                    Seus dados protegidos com criptografia de ponta a ponta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[720px] flex-col bg-[radial-gradient(circle_at_38%_26%,rgba(255,255,255,0.045),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] px-6 py-7 sm:px-10 lg:min-h-0 lg:px-16 xl:px-[8.5rem]">
          <div className="flex items-center justify-between">
            <Link
              href={currentStoreBrand.storefrontPath}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-blue-primary/45 hover:text-white lg:hidden"
            >
              Voltar para a loja
            </Link>

            <div className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-300">
              <Globe2 className="h-4 w-4" />
              <span>PT-BR</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[425px] flex-1 flex-col justify-center py-14">
            <img
              src={platformBrand.logoWhite}
              alt={platformBrand.name}
              className="mb-12 h-16 w-auto max-w-[330px]"
            />

            <div>
              <h1 className="font-display text-[2rem] font-medium leading-tight tracking-[-0.03em] text-white">
                Acesse sua conta
              </h1>
              <p className="mt-3 max-w-[360px] text-sm leading-6 text-slate-400">
                Gerencie lojas, produtos, pedidos e integrações com eficiência e
                segurança.
              </p>
            </div>

            <form action={formAction} className="mt-9 space-y-6">
              <input type="hidden" name="next" value={nextPath} />

              <TextInput
                id="email"
                label="E-mail"
                name="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
              />

              <TextInput
                id="password"
                label="Senha"
                name="password"
                type="password"
                placeholder="Digite sua senha"
                autoComplete="current-password"
                icon={<Lock className="h-4 w-4" />}
              />

              {state.error ? (
                <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {state.error}
                </p>
              ) : null}

              <SubmitButton />
            </form>

            <div className="my-8 flex items-center gap-4 text-xs text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              <span>ou</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm">
              <a
                href="/login/forgot"
                className="font-medium text-blue-400 transition hover:text-blue-300"
              >
                Esqueci minha senha
              </a>
              <Link
                href={currentStoreBrand.storefrontPath}
                className="hidden font-medium text-slate-400 transition hover:text-white lg:inline"
              >
                Voltar para a loja
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
