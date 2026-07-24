import { Building2 } from 'lucide-react';

export function PjDiscountNotice({
  percentage,
  compact = false,
}: {
  percentage: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100 ${
        compact ? 'rounded-xl px-3 py-2.5' : 'px-4 py-3'
      }`}
    >
      <Building2 className="h-4 w-4 shrink-0 text-green-accent" />
      <p className="text-xs font-semibold leading-5">
        Desconto para empresas com CNPJ: até{' '}
        {percentage.toLocaleString('pt-BR')}% nos produtos elegíveis. O valor
        confirmado aparece após entrar na conta.
      </p>
    </div>
  );
}
