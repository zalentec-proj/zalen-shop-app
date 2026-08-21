import {
  BadgeCheck,
  Boxes,
  MapPin,
  PackageCheck,
  Store,
  Truck,
} from 'lucide-react';
import {
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';
import { AdminContentGrid } from '@/components/admin/AdminLayout';
import {
  getShippingConfiguration,
  type ShippingMethod,
} from '@/modules/shipping/shipment.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import {
  updateShippingMethodAction,
  upsertShippingOriginAction,
} from './actions';

const methodIconByKind = {
  pickup: Store,
  fixed: Truck,
  manual: PackageCheck,
  external: Boxes,
} satisfies Record<ShippingMethod['kind'], typeof Truck>;

const methodLabelByKind: Record<ShippingMethod['kind'], string> = {
  pickup: 'Retirada',
  fixed: 'Frete fixo',
  manual: 'Entrega manual',
  external: 'Provider externo',
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDeliveryWindow(method: ShippingMethod) {
  if (
    method.minDeliveryDays === undefined ||
    method.maxDeliveryDays === undefined
  ) {
    return 'Prazo não definido';
  }

  if (method.minDeliveryDays === method.maxDeliveryDays) {
    return `${method.minDeliveryDays} dia(s) úteis`;
  }

  return `${method.minDeliveryDays} a ${method.maxDeliveryDays} dias úteis`;
}

export default async function ShippingSettingsPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const { origin, methods } = await getShippingConfiguration(store.id);
  const activeMethods = methods.filter((method) => method.status === 'active');
  const nativeMethods = methods.filter((method) => method.kind !== 'external');
  const externalMethods = methods.filter((method) => method.kind === 'external');

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Meios de envio"
        description="Configure origem e métodos nativos. O checkout calcula frete no servidor e salva uma cotação válida por 30 minutos."
        action={<SettingsBadge tone="success">Server-side</SettingsBadge>}
      >
        <div className="grid gap-2 md:grid-cols-4">
          {[
            ['Métodos ativos', activeMethods.length],
            ['Métodos nativos', nativeMethods.length],
            ['Providers externos', externalMethods.length],
            ['Origem', origin?.status === 'active' ? 'Ativa' : 'Pendente'],
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

      <AdminContentGrid
        sidebarWidth="340px"
        sidebar={
          <SettingsPanel
            title="Origem de envio"
            description="Uma origem por loja no MVP."
            action={
              <SettingsBadge tone={origin?.status === 'active' ? 'success' : 'warning'}>
                {origin?.status === 'active' ? 'Ativa' : 'Pendente'}
              </SettingsBadge>
            }
          >
            <form action={upsertShippingOriginAction} className="grid gap-3">
              <Field
                label="Remetente"
                name="senderName"
                defaultValue={origin?.senderName ?? ''}
                required
              />
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Field
                  label="CEP origem"
                  name="postalCode"
                  defaultValue={origin?.postalCode ?? ''}
                  required
                />
                <Field
                  label="UF"
                  name="state"
                  defaultValue={origin?.state ?? ''}
                  required
                />
              </div>
              <Field
                label="Rua/Avenida"
                name="street"
                defaultValue={origin?.street ?? ''}
                required
              />
              <div className="grid min-w-0 gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
                <Field
                  label="Número"
                  name="number"
                  defaultValue={origin?.number ?? ''}
                  required
                />
                <Field
                  label="Complemento"
                  name="complement"
                  defaultValue={origin?.complement ?? ''}
                />
              </div>
              <Field
                label="Bairro"
                name="district"
                defaultValue={origin?.district ?? ''}
                required
              />
              <Field
                label="Cidade"
                name="city"
                defaultValue={origin?.city ?? ''}
                required
              />
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_90px]">
                <Field
                  label="Telefone"
                  name="phone"
                  defaultValue={origin?.phone ?? ''}
                />
                <Field
                  label="País"
                  name="country"
                  defaultValue={origin?.country ?? 'BR'}
                  required
                />
              </div>
              <label className="grid gap-1 text-xs font-semibold text-slate-300">
                Status
                <select
                  name="status"
                  defaultValue={origin?.status ?? 'active'}
                  className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none"
                >
                  <option value="active">Ativa</option>
                  <option value="disabled">Desativada</option>
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-4 text-xs font-semibold text-white"
              >
                <MapPin className="h-3.5 w-3.5" />
                Salvar origem
              </button>
            </form>
          </SettingsPanel>
        }
      >
      <div className="grid gap-3">
        {methods.map((method) => {
          const Icon = methodIconByKind[method.kind];
          const active = method.status === 'active';
          const freeRule =
            method.freeOverSubtotal !== undefined
              ? `Grátis acima de ${formatCurrency(method.freeOverSubtotal)}`
              : 'Somente regras por produto/ERP';

          return (
            <section
              key={method.id}
              className="rounded-lg border border-white/6 bg-[#0A1730]/95 p-4"
            >
              <form
                action={updateShippingMethodAction}
                className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start"
              >
                <input type="hidden" name="methodId" value={method.id} />
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#101F43] text-[#7EC3FF]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-white">
                          {method.name}
                        </h2>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                          {method.description ?? 'Método configurável da loja.'}
                        </p>
                      </div>
                    </div>
                    <SettingsBadge tone={active ? 'success' : 'disabled'}>
                      {active ? 'Ativo' : 'Desativado'}
                    </SettingsBadge>
                  </div>

                  <div className="mt-4 grid gap-2 lg:grid-cols-3">
                    <Metric label="Tipo" value={methodLabelByKind[method.kind]} />
                    <Metric
                      label="Valor atual"
                      value={
                        method.price === 0 ? 'Grátis' : formatCurrency(method.price)
                      }
                    />
                    <Metric label="Prazo" value={formatDeliveryWindow(method)} />
                  </div>
                </div>

                <div className="rounded-lg border border-white/6 bg-[#081225] p-3">
                  <div className="grid gap-2">
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                      <Field
                        label="Valor"
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={String(method.price)}
                      />
                      <Field
                        label="Grátis acima de"
                        name="freeOverSubtotal"
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={
                          method.freeOverSubtotal !== undefined
                            ? String(method.freeOverSubtotal)
                            : ''
                        }
                      />
                    </div>
                    <p className="text-[11px] leading-4 text-slate-500">
                      Deixe “Grátis acima de” vazio para usar somente a
                      elegibilidade de frete dos produtos recebida do ERP.
                    </p>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                      <Field
                        label="Prazo mín."
                        name="minDeliveryDays"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={
                          method.minDeliveryDays !== undefined
                            ? String(method.minDeliveryDays)
                            : ''
                        }
                      />
                      <Field
                        label="Prazo máx."
                        name="maxDeliveryDays"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={
                          method.maxDeliveryDays !== undefined
                            ? String(method.maxDeliveryDays)
                            : ''
                        }
                      />
                      <label className="grid gap-1 text-xs font-semibold text-slate-300">
                        Status
                        <select
                          name="status"
                          defaultValue={method.status}
                          className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#0A1730] px-3 text-xs text-white outline-none"
                        >
                          <option value="active">Ativo</option>
                          <option value="disabled">Desativado</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" />
                      {freeRule}
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg border border-white/8 bg-[#0A1730] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-[#1E3DFF]/35 hover:text-white"
                    >
                      Salvar método
                    </button>
                  </div>
                </div>
              </form>
            </section>
          );
        })}
      </div>
      </AdminContentGrid>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
  min,
  step,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        step={step}
        defaultValue={defaultValue}
        className="h-9 min-w-0 w-full rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none transition focus:border-[#1E3DFF]/45"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/6 bg-[#081225] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold text-white">{value}</div>
    </div>
  );
}
