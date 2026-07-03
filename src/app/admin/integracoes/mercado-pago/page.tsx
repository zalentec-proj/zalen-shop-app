import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  PlugZap,
  Power,
  RotateCw,
  ShieldCheck,
  Unplug,
  WalletCards,
} from 'lucide-react';
import { AdminSidebar } from '@/app/admin/AdminSidebar';
import { logoutAction } from '@/app/login/actions';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { getMercadoPagoAdminState } from '@/modules/integrations/mercado-pago/mercado-pago.account.service';
import type {
  MercadoPagoEnvironment,
  MercadoPagoEnvironmentAdminState,
  MercadoPagoRuntimeStatus,
} from '@/modules/integrations/mercado-pago/mercado-pago.types';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import {
  disconnectMercadoPagoAction,
  setMercadoPagoActiveEnvironmentAction,
  testMercadoPagoConnectionAction,
} from './actions';

export const metadata: Metadata = {
  title: `${platformBrand.productName} Admin — Mercado Pago`,
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const environmentLabel: Record<MercadoPagoEnvironment, string> = {
  test: 'Teste',
  production: 'Produção',
};

const statusLabel: Record<MercadoPagoRuntimeStatus, string> = {
  connected: 'Conectado',
  pending_credentials: 'Pendente',
  disconnected: 'Desconectado',
  expired: 'Expirado',
  error: 'Erro',
  disabled: 'Desativado',
};

const errorLabel: Record<string, string> = {
  access_denied: 'Sua conta não possui permissão para gerenciar pagamentos desta loja.',
  callback_failed: 'Não foi possível concluir a conexão OAuth do Mercado Pago.',
  invalid_environment: 'Ambiente Mercado Pago inválido.',
  invalid_state: 'State OAuth inválido ou expirado. Inicie a conexão novamente.',
  missing_code: 'O Mercado Pago não retornou o código de autorização.',
  missing_config: 'Configuração OAuth Mercado Pago pendente no ambiente.',
  missing_encryption: 'Criptografia de credenciais pendente no ambiente.',
  missing_session: 'Sessão ausente no retorno OAuth. Faça login novamente.',
  provider_denied: 'Autorização negada no Mercado Pago.',
  test_failed_test: 'Teste de conexão falhou no ambiente de teste.',
  test_failed_production: 'Teste de conexão falhou no ambiente de produção.',
  activation_blocked_test: 'Não foi possível ativar teste. Configure as credenciais de teste antes.',
  activation_blocked_production: 'Produção ainda não pode ser ativada. Conecte OAuth, Public Key e webhook primeiro.',
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatOptionalDateTime(value?: string | null) {
  if (!value) {
    return 'Não registrado';
  }

  return dateTimeFormatter.format(new Date(value));
}

function statusClassName(status: MercadoPagoRuntimeStatus) {
  if (status === 'connected') {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
  }

  if (status === 'error' || status === 'expired') {
    return 'border-rose-400/20 bg-rose-400/10 text-rose-200';
  }

  if (status === 'disabled' || status === 'disconnected') {
    return 'border-slate-400/20 bg-slate-400/10 text-slate-300';
  }

  return 'border-amber-400/20 bg-amber-400/10 text-amber-200';
}

function StatusBadge({ status }: { status: MercadoPagoRuntimeStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName(status)}`}
    >
      {statusLabel[status]}
    </span>
  );
}

function EnvironmentCard({ state }: { state: MercadoPagoEnvironmentAdminState }) {
  const connected = state.status === 'connected' || state.status === 'expired';
  const primaryActionLabel = connected ? 'Reconectar' : 'Conectar';
  const accountRows = [
    ['Conta', state.account?.nickname ?? state.account?.email ?? 'Não informada'],
    ['User ID', state.account?.userId ?? 'Não informado'],
    ['Fonte', state.credentialsSource === 'oauth' ? 'OAuth por loja' : 'ENV legado'],
    ['Payment Brick', state.publicKeyConfigured ? 'Pronto' : 'Public Key pendente'],
    ['Conectado em', formatOptionalDateTime(state.connectedAt)],
    ['Token expira em', formatOptionalDateTime(state.tokenExpiresAt)],
  ];

  return (
    <section className="rounded-lg border border-white/8 bg-[#0A1730]/95">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-[#7EC3FF]" />
            <h2 className="text-base font-semibold">
              Ambiente {environmentLabel[state.environment]}
            </h2>
            {state.active ? (
              <span className="rounded-full border border-[#1E3DFF]/35 bg-[#1E3DFF]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9DBAFF]">
                Em uso
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Autorização Mercado Pago separada para {environmentLabel[state.environment].toLowerCase()}.
          </p>
        </div>
        <StatusBadge status={state.status} />
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          {accountRows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-2 text-xs"
            >
              <span className="text-slate-400">{label}</span>
              <span className="max-w-[260px] truncate font-semibold text-white">
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {state.canStartOAuth ? (
            <a
              href={state.connectPath}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              {primaryActionLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-500"
            >
              Configuração pendente
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}

          <form action={testMercadoPagoConnectionAction}>
            <input type="hidden" name="environment" value={state.environment} />
            <button
              type="submit"
              disabled={!state.canTestConnection}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Testar conexão
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </form>

          <form action={setMercadoPagoActiveEnvironmentAction}>
            <input type="hidden" name="environment" value={state.environment} />
            <button
              type="submit"
              disabled={state.active || !state.canActivate}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/30 bg-[#1E3DFF]/15 px-3 py-2 text-xs font-semibold text-[#BFD0FF] transition hover:border-[#1E3DFF]/55 hover:text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
            >
              {state.active
                ? 'Ambiente em uso'
                : `Usar ${environmentLabel[state.environment].toLowerCase()}`}
              <Power className="h-3.5 w-3.5" />
            </button>
          </form>

          <form action={disconnectMercadoPagoAction}>
            <input type="hidden" name="environment" value={state.environment} />
            <button
              type="submit"
              disabled={!connected}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Desconectar
              <Unplug className="h-3.5 w-3.5" />
            </button>
          </form>

          {!state.active && state.activationBlockedReason ? (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
              {state.activationBlockedReason}
            </p>
          ) : null}
        </div>
      </div>

      {state.warnings.length > 0 ? (
        <div className="space-y-2 px-4 pb-4">
          {state.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default async function MercadoPagoIntegrationPage({
  searchParams,
}: PageProps) {
  const user = await getCurrentUser();
  const storeResolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(storeResolution);

  if (!store) {
    notFound();
  }

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent('/admin/integracoes/mercado-pago')}`
    );
  }

  if (!(await canAccessStore(user.id, store.id))) {
    redirect('/admin');
  }

  const state = await getMercadoPagoAdminState(store.id);
  const params = (await searchParams) ?? {};
  const error = firstParam(params.error);
  const connected = firstParam(params.connected);
  const tested = firstParam(params.tested);
  const disconnected = firstParam(params.disconnected);
  const activated = firstParam(params.activated);

  return (
    <div className="min-h-screen bg-[#050A14] text-white">
      <AdminSidebar
        activeKey="payments"
        footerLabel="Conectores"
        footerTitle="Pagamentos"
        footerDescription={`Mercado Pago por loja para ${currentStoreBrand.shortName}.`}
      />

      <main className="xl:pl-60">
        <section className="w-full px-3 py-3 sm:px-4 lg:px-5">
          <div className="rounded-lg border border-white/8 bg-[#07101F] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-4 py-4">
              <div>
                <Link
                  href="/admin/configuracoes/pagamentos"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#8BB9FF] transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para pagamentos
                </Link>
                <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7EC3FF]">
                  Gateway de pagamento
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                  Mercado Pago
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Payment Brick com OAuth por loja. Tokens e refresh tokens ficam criptografados no servidor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-white/8 bg-[#0A1730] px-3 py-2 text-xs text-slate-300">
                  {user.email}
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </header>

            <div className="space-y-4 p-4">
              {error ? (
                <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                  {errorLabel[error] ?? 'Falha controlada na conexão Mercado Pago.'}
                </div>
              ) : null}

              {connected ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mercado Pago conectado em {environmentLabel[connected as MercadoPagoEnvironment] ?? connected}.
                </div>
              ) : null}

              {tested ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Conexão validada em {environmentLabel[tested as MercadoPagoEnvironment] ?? tested}.
                </div>
              ) : null}

              {disconnected ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-400/20 bg-slate-400/10 px-3 py-2 text-xs text-slate-100">
                  <Unplug className="h-3.5 w-3.5" />
                  Ambiente {environmentLabel[disconnected as MercadoPagoEnvironment] ?? disconnected} desconectado.
                </div>
              ) : null}

              {activated ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#1E3DFF]/25 bg-[#1E3DFF]/15 px-3 py-2 text-xs text-[#BFD0FF]">
                  <Power className="h-3.5 w-3.5" />
                  Ambiente ativo alterado para {environmentLabel[activated as MercadoPagoEnvironment] ?? activated}.
                </div>
              ) : null}

              <section className="rounded-lg border border-white/8 bg-[#0A1730]/95 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7EC3FF]">
                  Ambiente ativo
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {environmentLabel[state.activeEnvironment]}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      A loja permanece em teste até alguém ativar produção explicitamente.
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs text-slate-300">
                    Atualizado em {formatOptionalDateTime(state.activeEnvironmentUpdatedAt)}
                  </div>
                </div>
              </section>

              {state.warnings.length > 0 ? (
                <div className="space-y-2">
                  {state.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}

              <section className="grid gap-4 2xl:grid-cols-2">
                {state.environments.map((environmentState) => (
                  <EnvironmentCard
                    key={environmentState.environment}
                    state={environmentState}
                  />
                ))}
              </section>

              <section className="rounded-lg border border-white/8 bg-[#0A1730]/95 p-4">
                <PlugZap className="h-5 w-5 text-[#7EC3FF]" />
                <h2 className="mt-3 text-base font-semibold">Runtime multi-loja</h2>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                  {[
                    'Checkout cria pagamento com o ambiente ativo desta loja.',
                    'Webhook valida assinatura por ambiente e processa pelo store_id recebido.',
                    'Fallback ENV fica restrito à Brasil Drones até reconectar via OAuth.',
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5 text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
