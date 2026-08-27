import { BadgePercent, Calculator, ShieldCheck } from 'lucide-react';
import {
  SettingsBadge,
  SettingsPanel,
} from '../SettingsShell';
import { getAutomaticPjDiscountPolicy } from '@/modules/pricing/pricing.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { updateAutomaticPjDiscountAction } from './actions';
import { AdminActionForm } from '@/components/admin/AdminActionForm';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default async function PricingSettingsPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const policy = await getAutomaticPjDiscountPolicy(store.id);
  const enabled = policy?.automaticDiscountEnabled ?? false;
  const percentage = policy?.automaticDiscountPercentage ?? 10;
  const exampleBase = 100;
  const exampleFinal = exampleBase * (1 - percentage / 100);

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Preços para empresas"
        description="Regra nativa por loja para contas PJ com CNPJ matematicamente válido e dados fiscais completos."
        action={
          <SettingsBadge tone={enabled ? 'success' : 'neutral'}>
            {enabled ? 'Ativa' : 'Desativada'}
          </SettingsBadge>
        }
      >
        <AdminActionForm
          action={updateAutomaticPjDiscountAction}
          successMessage="Política de preços salva com sucesso."
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-white/6 bg-[#081225] p-4">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={enabled}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#050A14] accent-[#1E3DFF]"
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  Ativar desconto automático para PJ
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  O benefício aparece somente depois da autenticação e da validação
                  server-side do cadastro empresarial.
                </span>
              </span>
            </label>

            <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
              Percentual de desconto
              <span className="relative max-w-xs">
                <input
                  type="number"
                  name="percentage"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={percentage}
                  required
                  className="h-10 w-full rounded-lg border border-white/8 bg-[#081225] px-3 pr-10 text-sm text-white outline-none focus:border-[#1E3DFF]/60"
                />
                <BadgePercent className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#7EC3FF]" />
              </span>
              <span className="font-normal text-slate-500">
                Ao ativar, use um valor maior que zero e de até 100%.
              </span>
            </label>

            <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    Melhor preço, sem acumular
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Preço PJ específico por variante prevalece. Nos demais itens,
                    a loja compara promoção e desconto PJ e cobra o menor valor.
                    O frete nunca recebe esse percentual.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] px-5 text-xs font-semibold text-white"
            >
              Salvar política de preços
            </button>
          </div>

          <aside className="rounded-lg border border-white/6 bg-[#081225] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Calculator className="h-4 w-4 text-[#7EC3FF]" />
              Exemplo do cálculo
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Preço público</dt>
                <dd className="font-semibold text-white">
                  {currencyFormatter.format(exampleBase)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Desconto PJ</dt>
                <dd className="font-semibold text-emerald-300">
                  - {percentage.toLocaleString('pt-BR')}%
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-white/6 pt-3">
                <dt className="font-semibold text-white">Preço final</dt>
                <dd className="text-base font-semibold text-emerald-300">
                  {currencyFormatter.format(exampleFinal)}
                </dd>
              </div>
            </dl>
          </aside>
        </AdminActionForm>
      </SettingsPanel>
    </div>
  );
}
