import {
  BadgeCheck,
  Boxes,
  Building2,
  PackageCheck,
  Store,
  Truck,
} from 'lucide-react';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';

type ShippingStatus = 'active' | 'disabled' | 'pending' | 'future';

const shippingMethods: Array<{
  name: string;
  status: ShippingStatus;
  summary: string;
  coverage: string;
  rules: string[];
  note: string;
  action: string;
  icon: typeof Truck;
}> = [
  {
    name: 'Retirada na loja',
    status: 'active',
    summary: 'Permite que o cliente retire o pedido em um ponto definido pela operação.',
    coverage: 'Brasil Drones',
    rules: ['Sem custo de frete', 'Confirmação manual', 'Horário operacional'],
    note: 'Ideal para peças pequenas e clientes próximos ao centro de atendimento.',
    action: 'Configurar',
    icon: Store,
  },
  {
    name: 'Frete fixo',
    status: 'active',
    summary: 'Valor único por região ou regra simples enquanto cotações reais não estão ativas.',
    coverage: 'Regra local',
    rules: ['Valor manual', 'Sem cotação externa', 'Editável futuramente'],
    note: 'Não calcula distância, peso ou cubagem nesta sprint.',
    action: 'Configurar',
    icon: Truck,
  },
  {
    name: 'Frete grátis',
    status: 'disabled',
    summary: 'Campanha visual para liberar frete grátis por valor mínimo de pedido.',
    coverage: 'Campanha futura',
    rules: ['Valor mínimo', 'Categorias elegíveis', 'Região definida'],
    note: 'Estado visual apenas. A regra real deve ser calculada server-side.',
    action: 'Configurar',
    icon: BadgeCheck,
  },
  {
    name: 'Melhor Envio',
    status: 'pending',
    summary: 'Operador logístico planejado para cotação e etiqueta após pesquisa técnica.',
    coverage: 'Transportadoras parceiras',
    rules: ['OAuth/API futura', 'Cotação server-side', 'Etiqueta futura'],
    note: 'Nenhuma chamada ao Melhor Envio foi implementada.',
    action: 'Finalizar configuração',
    icon: Boxes,
  },
  {
    name: 'Correios',
    status: 'future',
    summary: 'Integração futura para serviços dos Correios quando a estratégia logística for definida.',
    coverage: 'Nacional',
    rules: ['PAC', 'Sedex', 'Contrato futuro'],
    note: 'Fora do escopo atual.',
    action: 'Em breve',
    icon: PackageCheck,
  },
];

const statusLabel: Record<ShippingStatus, string> = {
  active: 'Ativado',
  disabled: 'Desativado',
  pending: 'Pendente',
  future: 'Futuro',
};

const statusTone: Record<ShippingStatus, 'success' | 'disabled' | 'warning' | 'neutral'> = {
  active: 'success',
  disabled: 'disabled',
  pending: 'warning',
  future: 'neutral',
};

export default function ShippingSettingsPage() {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Meios de envio"
        description="Defina opções de entrega e retirada. Nesta etapa, os métodos são visuais e não calculam frete real."
        action={<SettingsActionButton variant="primary" disabled>Novo envio</SettingsActionButton>}
      >
        <div className="grid gap-2 md:grid-cols-3">
          {[
            ['Métodos ativos', shippingMethods.filter((method) => method.status === 'active').length],
            ['Pendentes', shippingMethods.filter((method) => method.status === 'pending').length],
            ['Planejados', shippingMethods.filter((method) => method.status === 'future').length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                {label}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      </SettingsPanel>

      <div className="grid gap-3">
        {shippingMethods.map((method) => {
          const Icon = method.icon;
          const isFuture = method.status === 'future';

          return (
            <section
              key={method.name}
              className="rounded-lg border border-white/6 bg-[#0A1730]/95 p-4"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-[#7EC3FF]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-white">{method.name}</h2>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                          {method.summary}
                        </p>
                      </div>
                    </div>
                    <SettingsBadge tone={statusTone[method.status]}>
                      {statusLabel[method.status]}
                    </SettingsBadge>
                  </div>

                  <div className="mt-4 grid gap-2 lg:grid-cols-[190px_1fr]">
                    <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Cobertura
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">{method.coverage}</div>
                    </div>
                    <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Regras visuais
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {method.rules.map((rule) => (
                          <SettingsBadge key={rule} tone="info">{rule}</SettingsBadge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Building2 className="h-3.5 w-3.5 text-[#7EC3FF]" />
                    Operação local
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">{method.note}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SettingsActionButton disabled={isFuture}>{method.action}</SettingsActionButton>
                    {method.status !== 'future' ? (
                      <SettingsActionButton disabled>
                        {method.status === 'active' ? 'Desativar' : 'Ativar'}
                      </SettingsActionButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
