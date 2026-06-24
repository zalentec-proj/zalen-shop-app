import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Globe2,
  LockKeyhole,
  Server,
} from 'lucide-react';
import { currentStoreBrand } from '@/lib/branding/current-store-brand';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';

const domainRows = [
  {
    label: 'Domínio atual',
    value: 'localhost:3000/admin',
    status: 'Ambiente local',
    tone: 'info' as const,
  },
  {
    label: 'Domínio padrão futuro',
    value: 'brasil-drones.zalenshop.com.br',
    status: 'Reservado',
    tone: 'success' as const,
  },
  {
    label: 'Domínio próprio futuro',
    value: 'www.brasildrones.com.br',
    status: 'DNS pendente',
    tone: 'warning' as const,
  },
];

const dnsChecklist = [
  {
    title: 'Apontar CNAME',
    detail: 'Configurar o domínio próprio para apontar ao host da Zalen quando a resolução dinâmica estiver pronta.',
    icon: Server,
  },
  {
    title: 'Validar certificado',
    detail: 'SSL será tratado no deploy final, sem exposição de chaves no frontend.',
    icon: LockKeyhole,
  },
  {
    title: 'Definir domínio principal',
    detail: 'A loja poderá manter o subdomínio Zalen como fallback operacional.',
    icon: ClipboardList,
  },
];

export default function DomainsSettingsPage() {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Domínios"
        description="Estrutura inicial para domínio padrão da Zalen e domínio próprio da loja ativa. DNS real fica fora desta sprint."
        action={<SettingsBadge tone="warning">DNS mockado</SettingsBadge>}
      >
        <div className="grid gap-3">
          {domainRows.map((row) => (
            <div
              key={row.label}
              className="grid gap-3 rounded-lg border border-white/6 bg-[#081225] px-3 py-3 lg:grid-cols-[180px_1fr_140px] lg:items-center"
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

      <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:items-start">
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
                  {currentStoreBrand.shortName}
                </div>
              </div>
              <SettingsBadge tone="success">Operacional</SettingsBadge>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                Domínio Zalen planejado como padrão.
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                Domínio próprio depende de resolução por host.
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
