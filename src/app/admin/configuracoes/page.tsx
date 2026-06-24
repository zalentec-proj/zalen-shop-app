import Link from 'next/link';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Globe2,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Truck,
  UsersRound,
} from 'lucide-react';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsPanel,
} from './SettingsShell';

const setupAreas = [
  {
    title: 'Pagamentos',
    description: 'Gateways, Pix manual e opções de pagamento offline.',
    href: '/admin/configuracoes/pagamentos',
    icon: CreditCard,
    status: 'Pendente',
  },
  {
    title: 'Envios',
    description: 'Retirada, frete fixo, frete grátis e operadores logísticos.',
    href: '/admin/configuracoes/envios',
    icon: Truck,
    status: 'Inicial',
  },
  {
    title: 'Domínios',
    description: 'Domínio padrão Zalen e domínio próprio da loja.',
    href: '/admin/configuracoes/dominios',
    icon: Globe2,
    status: 'Planejado',
  },
];

const futureAreas = [
  { label: 'Notas fiscais', icon: ReceiptText, detail: 'Emissão fiscal e declaração de conteúdo.' },
  { label: 'Comunicação', icon: Bell, detail: 'Contato, WhatsApp e e-mails automáticos.' },
  { label: 'Checkout', icon: PackageCheck, detail: 'Mensagens, campos e regras da finalização.' },
  { label: 'Usuários', icon: UsersRound, detail: 'Operadores, papéis e permissões da loja.' },
];

export default function SettingsIndexPage() {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Central de configurações"
        description="Arquitetura organizada para operar a loja dentro da Zalen, com conectores externos ativados somente quando houver implementação aprovada."
        action={<SettingsBadge tone="info">Zalen Shop</SettingsBadge>}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {setupAreas.map((area) => {
            const Icon = area.icon;

            return (
              <Link
                key={area.title}
                href={area.href}
                className="group rounded-lg border border-white/6 bg-[#081225] p-4 transition hover:border-[#1E3DFF]/30 hover:bg-[#0B1831]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-[#7EC3FF]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <SettingsBadge tone={area.status === 'Pendente' ? 'warning' : 'neutral'}>
                    {area.status}
                  </SettingsBadge>
                </div>
                <h2 className="mt-4 text-sm font-semibold text-white">{area.title}</h2>
                <p className="mt-2 min-h-10 text-xs leading-5 text-slate-400">
                  {area.description}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#A9C7FF]">
                  Abrir configuração
                  <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </SettingsPanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:items-start">
        <SettingsPanel
          title="Grupos planejados"
          description="A navegação secundária já reflete a plataforma completa, mas as páginas abaixo serão habilitadas em sprints futuras."
        >
          <div className="grid gap-2 md:grid-cols-2">
            {futureAreas.map((area) => {
              const Icon = area.icon;

              return (
                <div key={area.label} className="rounded-lg border border-white/6 bg-[#081225] p-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-[#0A1730] text-slate-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">{area.label}</div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">
                        {area.detail}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsPanel>

        <SettingsPanel
          title="Guardrails"
          description="Limites ativos nesta entrega."
        >
          <div className="space-y-2">
            {[
              'Nenhum pagamento real foi implementado.',
              'Nenhum frete real foi implementado.',
              'Domínios e DNS permanecem visuais.',
              'Tokens e secrets não entram no frontend.',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
              >
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <span className="text-xs leading-5 text-slate-300">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <SettingsActionButton disabled>Salvar alterações</SettingsActionButton>
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}
