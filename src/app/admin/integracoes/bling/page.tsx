import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { AdminPageFrame } from '@/components/admin/AdminLayout';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import {
  checkStoreRole,
  getCurrentUser,
  canAccessStore,
  storeManagementRoles,
  storeOperationalRoles,
} from '@/modules/auth/auth.service';
import { getBlingAdminState } from '@/modules/integrations/bling/bling.service';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import { BlingHomologationPanel } from './BlingHomologationPanel';
import { BlingInventorySyncPanel } from './BlingInventorySyncPanel';
import { BlingProductSyncPanel } from './BlingProductSyncPanel';
import { BlingWebhookProcessPanel } from './BlingWebhookProcessPanel';
import { BlingTestOrderSendPanel } from './BlingTestOrderSendPanel';

export const metadata: Metadata = {
  title: `${platformBrand.productName} Admin — Bling`,
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabel = {
  planned: 'Planejado',
  pending_credentials: 'Credenciais pendentes',
  connected: 'Conectado',
  error: 'Erro de conexão',
  disconnected: 'Desconectado',
} as const;

const errorLabel: Record<string, string> = {
  access_denied: 'Sua conta não possui acesso à loja ativa.',
  callback_failed: 'Não foi possível concluir o callback OAuth do Bling.',
  invalid_state: 'State OAuth inválido ou expirado. Tente iniciar a conexão novamente.',
  missing_config: 'Configuração do Bling pendente no ambiente.',
  missing_encryption: 'Criptografia de credenciais pendente no ambiente.',
  missing_session: 'Sessão ausente no retorno OAuth. Faça login novamente.',
  provider_denied: 'Autorização negada no Bling.',
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatOptionalDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return dateTimeFormatter.format(new Date(value));
}

function StatusBadge({ status }: { status: keyof typeof statusLabel }) {
  const className =
    status === 'connected'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
      : status === 'error'
        ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
        : 'border-amber-400/20 bg-amber-400/10 text-amber-200';

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      {statusLabel[status]}
    </span>
  );
}

export default async function BlingIntegrationPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const storeResolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(storeResolution);

  if (!store) {
    notFound();
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/integracoes/bling')}`);
  }

  if (!(await canAccessStore(user.id, store.id))) {
    redirect('/admin');
  }

  const state = await getBlingAdminState(store.id);
  const managementAccess = await checkStoreRole(store.id, storeManagementRoles);
  const operationalAccess = await checkStoreRole(store.id, storeOperationalRoles);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === 'string' ? params.error : undefined;
  const status = state.status in statusLabel ? state.status : 'pending_credentials';
  const canRunBlingJobs =
    status === 'connected' &&
    state.isEncryptionConfigured &&
    operationalAccess.allowed;
  const statusCards = [
    { label: 'Ambiente', value: state.environment },
    { label: 'Último sync', value: formatOptionalDateTime(state.lastSyncAt) ?? 'Sem sync' },
    {
      label: 'Envio pedidos',
      value: state.orderSend.enabled ? 'Ligado' : 'Desligado',
    },
    {
      label: 'Última atualização',
      value: formatOptionalDateTime(state.lastUpdatedAt) ?? 'Não registrada',
    },
  ];

  return (
    <AdminPageFrame>
          <div className="rounded-lg border border-white/8 bg-[#07101F] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-4 py-4">
              <div>
                <Link
                  href="/admin/integracoes"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#8BB9FF] transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para integrações
                </Link>
                <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7EC3FF]">
                  ERP principal
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                  Bling
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Sincronize catálogo, estoque e pedidos de {store.shortName}.
                </p>
              </div>

              <StatusBadge status={status} />
            </header>

            <div className="space-y-4 p-4">
              <section className="rounded-lg border border-white/8 bg-[#0A1730]/95">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
                  <div>
                    <h2 className="text-base font-semibold">Status da integração</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Saúde e disponibilidade do conector para esta loja.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={status} />
                    {state.canStartOAuth && managementAccess.allowed ? (
                      <a
                        href={state.connectPath}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                      >
                        Conectar Bling
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-500"
                      >
                        {state.canStartOAuth
                          ? 'Permissão de gestão necessária'
                          : 'Configuração pendente'}
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 p-4 md:grid-cols-4">
                  {statusCards.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/6 bg-[#081225] px-3 py-3"
                    >
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm font-semibold">{item.value}</div>
                    </div>
                  ))}
                </div>

                {error ? (
                  <div className="mx-4 mb-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                    {errorLabel[error] ?? 'Falha controlada na conexão Bling.'}
                  </div>
                ) : null}

                {state.warnings.length > 0 ? (
                  <div className="mx-4 mb-4 space-y-2">
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

              <details className="group rounded-lg border border-white/8 bg-[#07101F]" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                  <div>
                    <h2 className="text-base font-semibold">Catálogo e estoque</h2>
                    <p className="mt-1 text-xs text-slate-400">Sincronização de produtos, preços e disponibilidade.</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-white/8 p-4">
                  <BlingProductSyncPanel
                    canRun={canRunBlingJobs}
                    initialStatus={state.productSync?.status}
                    initialUpdatedAt={state.productSync?.updatedAt}
                    initialSummary={state.productSync?.summary}
                  />

                  <BlingInventorySyncPanel
                    canRun={canRunBlingJobs}
                    initialStatus={state.inventorySync?.status}
                    initialUpdatedAt={state.inventorySync?.updatedAt}
                    initialSummary={state.inventorySync?.summary}
                  />
                </div>
              </details>

              <details className="group rounded-lg border border-white/8 bg-[#07101F]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                  <div>
                    <h2 className="text-base font-semibold">Webhooks e automação</h2>
                    <p className="mt-1 text-xs text-slate-400">Eventos recebidos e envio automático de pedidos.</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-white/8 p-4">
                  <BlingWebhookProcessPanel
                    canRun={canRunBlingJobs}
                    initialSummary={state.webhooks}
                    orderSend={state.orderSend}
                  />
                </div>
              </details>

              {managementAccess.allowed ? (
                <details className="group rounded-lg border border-white/8 bg-[#07101F]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <h2 className="text-base font-semibold">Ferramentas avançadas</h2>
                      <p className="mt-1 text-xs text-slate-400">Homologação e envio manual controlado para diagnóstico.</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 border-t border-white/8 p-4 2xl:grid-cols-2">
                  <BlingHomologationPanel
                    canRun={canRunBlingJobs && managementAccess.allowed}
                    initialStatus={state.homologation?.status}
                    initialSummary={state.homologation?.summary}
                  />

                  <BlingTestOrderSendPanel
                    canRun={canRunBlingJobs && managementAccess.allowed}
                  />
                  </div>
                </details>
              ) : null}
            </div>
          </div>
    </AdminPageFrame>
  );
}
