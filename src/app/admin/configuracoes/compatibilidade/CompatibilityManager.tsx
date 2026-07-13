'use client';

import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { saveProductDroneModelsAction } from './actions';

interface ModelOption {
  id: string;
  label: string;
  lineLabel: string;
}

interface ProductCompatibilityRow {
  id: string;
  name: string;
  sku?: string;
  status: string;
  currentModelIds: string[];
  suggestedModelIds: string[];
}

interface CompatibilityManagerProps {
  models: ModelOption[];
  products: ProductCompatibilityRow[];
}

type Filter = 'all' | 'defined' | 'suggested' | 'missing';

export default function CompatibilityManager({
  models,
  products,
}: CompatibilityManagerProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');

    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        `${product.name} ${product.sku ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (filter === 'defined') return product.currentModelIds.length > 0;
      if (filter === 'suggested') return product.suggestedModelIds.length > 0;
      if (filter === 'missing') return product.currentModelIds.length === 0;
      return true;
    });
  }, [filter, products, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-white/6 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Compatibilidade por modelo</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
            A categoria técnica do produto é preservada. Esta associação serve apenas para exibir peças e acessórios nos modelos DJI compatíveis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <span className="sr-only">Buscar produto</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto ou SKU"
              className="h-9 w-64 rounded-lg border border-white/8 bg-[#050A14] pl-9 pr-3 text-xs text-white outline-none focus:border-[#1E3DFF]/45"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar produtos</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-9 rounded-lg border border-white/8 bg-[#081225] px-3 text-xs text-white outline-none"
            >
              <option value="all">Todos</option>
              <option value="defined">Com compatibilidade</option>
              <option value="suggested">Com sugestão</option>
              <option value="missing">Sem compatibilidade</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead className="border-b border-white/8 text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-2 py-3 font-semibold">Produto</th>
              <th className="px-2 py-3 font-semibold">Compatibilidade atual</th>
              <th className="px-2 py-3 font-semibold">Modelos confirmados</th>
              <th className="px-2 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {visibleProducts.map((product) => {
              const currentModels = product.currentModelIds
                .map((id) => modelsById.get(id)?.label)
                .filter(Boolean);
              const suggestedModels = product.suggestedModelIds
                .filter((id) => !product.currentModelIds.includes(id))
                .map((id) => modelsById.get(id)?.label)
                .filter(Boolean);

              return (
                <tr key={product.id} className="align-top">
                  <td className="px-2 py-4">
                    <p className="max-w-[280px] font-semibold leading-5 text-white">{product.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{product.sku ?? 'SKU não informado'}</p>
                  </td>
                  <td className="px-2 py-4">
                    {currentModels.length > 0 ? (
                      <p className="max-w-[180px] leading-5 text-emerald-300">{currentModels.join(', ')}</p>
                    ) : (
                      <p className="text-slate-500">Não definido</p>
                    )}
                    {suggestedModels.length > 0 ? (
                      <p className="mt-2 flex max-w-[220px] items-start gap-1.5 leading-5 text-amber-200">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Sugestão: {suggestedModels.join(', ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-4">
                    <form action={saveProductDroneModelsAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <label className="sr-only" htmlFor={`models-${product.id}`}>
                        Modelos compatíveis para {product.name}
                      </label>
                      <select
                        id={`models-${product.id}`}
                        name="modelIds"
                        multiple
                        defaultValue={product.currentModelIds}
                        className="h-24 min-w-[240px] rounded-lg border border-white/8 bg-[#050A14] px-2 py-1 text-xs text-white outline-none focus:border-[#1E3DFF]/45"
                      >
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.lineLabel} - {model.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="h-9 rounded-lg border border-[#1E3DFF]/35 bg-[#101F43] px-3 text-xs font-semibold text-white transition hover:bg-[#1E3DFF]/30"
                      >
                        Salvar
                      </button>
                    </form>
                  </td>
                  <td className="px-2 py-4 text-right text-[11px] text-slate-500">{product.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum produto encontrado para este filtro.</p>
      ) : null}
    </div>
  );
}
