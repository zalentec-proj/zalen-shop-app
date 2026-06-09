import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  QrCode,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';

type PaymentStatus = 'active' | 'disabled' | 'pending' | 'future';

const paymentProviders: Array<{
  name: string;
  status: PaymentStatus;
  summary: string;
  sellsWith: string[];
  note: string;
  action: string;
  icon: typeof CreditCard;
}> = [
  {
    name: 'Mercado Pago',
    status: 'pending',
    summary: 'Gateway planejado para cartão, Pix e boleto quando a pesquisa técnica estiver aprovada.',
    sellsWith: ['Cartão de crédito', 'Pix', 'Boleto'],
    note: 'Taxas exibidas apenas como referência visual. Integração real ainda não implementada.',
    action: 'Finalizar configuração',
    icon: WalletCards,
  },
  {
    name: 'Pagamento manual',
    status: 'active',
    summary: 'Método operacional para combinar pagamento fora da loja, sem captura automática.',
    sellsWith: ['Transferência', 'Combinar com vendedor'],
    note: 'Sem conciliação automática. Requer confirmação operacional do pedido.',
    action: 'Configurar',
    icon: Landmark,
  },
  {
    name: 'Pix manual',
    status: 'active',
    summary: 'Chave Pix exibida ao cliente, com confirmação manual pelo operador.',
    sellsWith: ['Pix copia e cola', 'Chave Pix'],
    note: 'Não valida pagamento em tempo real e não usa webhook.',
    action: 'Configurar',
    icon: QrCode,
  },
  {
    name: 'Pagar.me',
    status: 'future',
    summary: 'Gateway futuro para cartão, Pix e boleto em uma próxima etapa da plataforma.',
    sellsWith: ['Cartão', 'Pix', 'Boleto'],
    note: 'Provider futuro. Nenhum endpoint ou credential flow foi implementado.',
    action: 'Em breve',
    icon: CreditCard,
  },
  {
    name: 'Stripe',
    status: 'future',
    summary: 'Gateway futuro para cenários internacionais e assinaturas em fases posteriores.',
    sellsWith: ['Cartão internacional', 'Wallets'],
    note: 'Fora do escopo do MVP Brasil Drones.',
    action: 'Em breve',
    icon: Banknote,
  },
];

const statusLabel: Record<PaymentStatus, string> = {
  active: 'Ativado',
  disabled: 'Desativado',
  pending: 'Pendente',
  future: 'Futuro',
};

const statusTone: Record<PaymentStatus, 'success' | 'disabled' | 'warning' | 'neutral'> = {
  active: 'success',
  disabled: 'disabled',
  pending: 'warning',
  future: 'neutral',
};

export default function PaymentSettingsPage() {
  const activeCount = paymentProviders.filter((provider) => provider.status === 'active').length;
  const pendingCount = paymentProviders.filter((provider) => provider.status === 'pending').length;
  const disabledCount = paymentProviders.filter((provider) => provider.status === 'disabled').length;

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Meios de pagamento"
        description="Configure como a loja poderá receber pagamentos. Esta tela é visual e não executa transações reais."
        action={<SettingsActionButton variant="primary" disabled>Novo meio</SettingsActionButton>}
      >
        <div className="flex flex-wrap gap-2">
          {[
            ['Todos', paymentProviders.length],
            ['Ativados', activeCount],
            ['Desativados', disabledCount],
            ['Pendentes', pendingCount],
          ].map(([label, count]) => (
            <button
              key={label}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[#081225] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-[#1E3DFF]/30 hover:text-white"
            >
              {label}
              <span className="text-[10px] opacity-70">{count}</span>
            </button>
          ))}
        </div>
      </SettingsPanel>

      <div className="grid gap-3">
        {paymentProviders.map((provider) => {
          const Icon = provider.icon;
          const isFuture = provider.status === 'future';

          return (
            <section
              key={provider.name}
              className="rounded-lg border border-white/6 bg-[#0A1730]/95 p-4"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-[#7EC3FF]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-white">{provider.name}</h2>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                          {provider.summary}
                        </p>
                      </div>
                    </div>
                    <SettingsBadge tone={statusTone[provider.status]}>
                      {statusLabel[provider.status]}
                    </SettingsBadge>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Permite vender com
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {provider.sellsWith.map((item) => (
                          <SettingsBadge key={item} tone="info">{item}</SettingsBadge>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        Observações
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">{provider.note}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                    Sem credenciais no frontend
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">
                    A configuração real dependerá de conector server-side e validação oficial.
                  </p>
                  <div className="mt-4">
                    <SettingsActionButton disabled={isFuture}>
                      {provider.action}
                      {provider.status === 'active' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </SettingsActionButton>
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
