import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Globe2,
  LockKeyhole,
  Server,
} from 'lucide-react';
import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';

const dnsChecklist = [
  {
    title: 'Usar subdomínio Zalen',
    detail: 'O slug da loja resolve o contexto operacional antes de buscar catálogo, pedidos e conectores.',
    icon: Server,
  },
  {
    title: 'Compartilhar sessão segura',
    detail: 'Em produção, AUTH_COOKIE_DOMAIN permite que login em app.zalenshop.com.br funcione no subdomínio da loja.',
    icon: LockKeyhole,
  },
  {
    title: 'Preparar domínio próprio',
    detail: 'Domínio próprio entra depois, com DNS, certificado e associação explícita à loja.',
    icon: ClipboardList,
  },
];

export const dynamic = 'force-dynamic';

async function getDomainRows() {
  const headerStore = await headers();
  const store = await resolveCurrentStoreFromHeaders();
  const currentHost = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost';
  const rootDomain = getServerEnv().PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';
  const storeSlug = store.slug;

  return {
    store,
    rows: [
      {
        label: 'Endereço atual',
        value: currentHost,
        status:
          currentHost.includes('localhost') || currentHost.includes('127.0.0.1')
            ? 'Fallback local'
            : 'Resolvido',
        tone: 'info' as const,
      },
      {
        label: 'Subdomínio da loja',
        value: `${storeSlug}.${rootDomain}`,
        status: 'Padrão Zalen',
        tone: 'info' as const,
      },
      {
        label: 'Alias local',
        value: `${storeSlug}.lvh.me:3000`,
        status: 'Dev',
        tone: 'neutral' as const,
      },
      {
        label: 'Domínio próprio',
        value: 'Nenhum domínio próprio cadastrado',
        status: 'Não configurado',
        tone: 'warning' as const,
      },
    ],
  };
}

export default async function DomainsSettingsPage() {
  const { store, rows: domainRows } = await getDomainRows();

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Domínios"
        description="O painel mostra o host atual e o endereço padrão calculado para a loja. Domínio próprio ainda não é persistido no modelo de dados."
        action={<SettingsBadge tone="info">Subdomínio padrão</SettingsBadge>}
      >
        <div className="grid gap-3">
          {domainRows.map((row) => (
            <div
              key={row.label}
              className="grid min-w-0 gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-3 lg:grid-cols-[180px_minmax(0,1fr)_140px] lg:items-center"
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                {row.label}
              </div>
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-white">
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-[#7EC3FF]" />
                <span className="truncate">{row.value}</span>
              </div>
              <div className="lg:text-right">
                <SettingsBadge tone={row.tone}>{row.status}</SettingsBadge>
              </div>
            </div>
          ))}
        </div>
      </SettingsPanel>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <SettingsPanel
          title="Orientação visual de DNS"
          description="Passos previstos para quando domínio próprio entrar no escopo técnico."
        >
          <div className="space-y-2">
            {dnsChecklist.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="flex gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-3"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-[#7EC3FF]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-white">{item.title}</span>
                      <SettingsBadge tone={index === 0 ? 'warning' : 'neutral'}>
                        Etapa {index + 1}
                      </SettingsBadge>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsPanel>

        <SettingsPanel
          title="Status da loja"
          description="Leitura operacional para a store ativa."
        >
          <div className="rounded-lg border border-white/6 bg-[linear-gradient(135deg,rgba(30,61,255,0.16),rgba(8,18,37,0.96))] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Loja ativa
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {store.shortName}
                </div>
              </div>
              <SettingsBadge tone={store.source === 'supabase' ? 'success' : 'warning'}>
                {store.source === 'supabase' ? 'Resolvida no banco' : 'Fallback local'}
              </SettingsBadge>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                O subdomínio padrão é calculado a partir do slug da loja ativa.
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                Domínio próprio exige modelagem, cadastro, DNS e certificado antes de poder ser exibido como ativo.
              </div>
            </div>
            <div className="mt-4">
              <SettingsActionButton disabled>Adicionar domínio</SettingsActionButton>
            </div>
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}
