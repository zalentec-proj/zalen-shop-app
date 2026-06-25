import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  QrCode,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { getMercadoPagoRuntimeState } from '@/modules/integrations/mercado-pago/mercado-pago.connector';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';

type PaymentStatus = 'active' | 'beta' | 'disabled' | 'pending' | 'future';

type PaymentProviderCard = {
  name: string;
  status: PaymentStatus;
  summary: string;
  sellsWith: string[];
  note: string;
  action: string;
  icon: typeof CreditCard;
  href?: string;
  actionDisabled?: boolean;
};

function getMercadoPagoPaymentProvider(
  state: Awaited<ReturnType<typeof getMercadoPagoRuntimeState>>
): PaymentProviderCard {
  const status: PaymentStatus =
    state.status === 'connected'
      ? 'beta'
      : state.status === 'disabled'
        ? 'disabled'
        : 'pending';
  const missingEnv = state.missingEnv.join(', ');

  return {
    name: 'Mercado Pago',
    status,
    summary: 'Checkout Pro para cartão, Pix e boleto com conciliação server-side.',
    sellsWith: ['Cartão de crédito', 'Pix', 'Boleto'],
    note:
      state.status === 'connected'
        ? `Ambiente ${state.environment}. Credenciais por ${state.credentialsSource === 'oauth' ? 'OAuth da loja' : 'ENV legado da Brasil Drones'}.`
        : state.status === 'disabled'
          ? 'Desativado em store_integrations para a loja ativa.'
          : `Pendente de configuração: ${missingEnv}.`,
    action: state.status === 'connected' ? 'Gerenciar' : 'Conectar',
    icon: WalletCards,
    href: '/admin/integracoes/mercado-pago',
  };
}

function getStaticPaymentProviders(): PaymentProviderCard[] {
  return [
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
}

const statusLabel: Record<PaymentStatus, string> = {
  active: 'Ativado',
  beta: 'Beta',
  disabled: 'Desativado',
  pending: 'Pendente',
  future: 'Futuro',
};

const statusTone: Record<PaymentStatus, 'success' | 'disabled' | 'warning' | 'neutral' | 'info'> = {
  active: 'success',
  beta: 'info',
  disabled: 'disabled',
  pending: 'warning',
  future: 'neutral',
};

export default async function PaymentSettingsPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const mercadoPagoState = await getMercadoPagoRuntimeState(store.id);
  const paymentProviders = [
    getMercadoPagoPaymentProvider(mercadoPagoState),
    ...getStaticPaymentProviders(),
  ];
  const activeCount = paymentProviders.filter((provider) =>
    ['active', 'beta'].includes(provider.status)
  ).length;
  const pendingCount = paymentProviders.filter((provider) => provider.status === 'pending').length;
  const disabledCount = paymentProviders.filter((provider) => provider.status === 'disabled').length;

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Meios de pagamento"
        description="Configure como a loja poderá receber pagamentos. Mercado Pago já opera em beta via Checkout Pro."
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
        <SettingsPanel
          title="Métodos disponíveis"
          description="Status operacional da loja ativa."
        >
          <div className="overflow-hidden rounded-lg border border-white/6">
            {paymentProviders.map((provider) => {
              const Icon = provider.icon;
              const isFuture = provider.status === 'future';

              return (
                <div
                  key={provider.name}
                  className="grid gap-3 border-b border-white/6 bg-[#081225] px-3 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_110px_150px] md:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-[#7EC3FF]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-white">{provider.name}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {provider.summary}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {provider.sellsWith.map((item) => (
                          <SettingsBadge key={item} tone="info">{item}</SettingsBadge>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {provider.note}
                      </p>
                    </div>
                  </div>

                  <div className="md:justify-self-end">
                    <SettingsBadge tone={statusTone[provider.status]}>
                      {statusLabel[provider.status]}
                    </SettingsBadge>
                  </div>

                  <div className="md:justify-self-end">
                    {provider.href && !isFuture && !provider.actionDisabled ? (
                      <Link
                        href={provider.href}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white"
                      >
                        {provider.action}
                        {['active', 'beta'].includes(provider.status) ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : null}
                      </Link>
                    ) : (
                      <SettingsActionButton disabled={isFuture || provider.actionDisabled}>
                        {provider.action}
                        {['active', 'beta'].includes(provider.status) ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : null}
                      </SettingsActionButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsPanel>

        <SettingsPanel title="Guardrails" description="Limites desta etapa.">
          <div className="space-y-2">
            {[
              'Mercado Pago usa Checkout Pro server-side nesta beta.',
              'Credenciais continuam fora do frontend e não aparecem no admin.',
              'Webhook assinado e retorno de pagamento usam a mesma conciliação.',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5"
              >
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <span className="text-[11px] leading-5 text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}
