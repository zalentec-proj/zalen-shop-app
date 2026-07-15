'use client';

import { useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
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

interface ModelPickerProps {
  currentModelIds: string[];
  models: ModelOption[];
  productId: string;
  productName: string;
  suggestedModelIds: string[];
}

function ModelPicker({
  currentModelIds,
  models,
  productId,
  productName,
  suggestedModelIds,
}: ModelPickerProps) {
  const [selectedModelIds, setSelectedModelIds] = useState(() => new Set(currentModelIds));
  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const modelsByLine = useMemo(() => {
    return models.reduce<Map<string, ModelOption[]>>((groups, model) => {
      const current = groups.get(model.lineLabel) ?? [];
      current.push(model);
      groups.set(model.lineLabel, current);
      return groups;
    }, new Map());
  }, [models]);
  const selectedModels = Array.from(selectedModelIds)
    .map((modelId) => modelsById.get(modelId))
    .filter((model): model is ModelOption => Boolean(model));
  const suggestedModels = suggestedModelIds
    .map((modelId) => modelsById.get(modelId))
    .filter((model): model is ModelOption => Boolean(model));

  function toggleModel(modelId: string) {
    setSelectedModelIds((current) => {
      const next = new Set(current);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }

  function applySuggestion(replaceSelection: boolean) {
    setSelectedModelIds((current) => {
      const next = replaceSelection ? new Set<string>() : new Set(current);
      suggestedModelIds.forEach((modelId) => next.add(modelId));
      return next;
    });
  }

  return (
    <form action={saveProductDroneModelsAction} className="min-w-[340px] space-y-2">
      <input type="hidden" name="productId" value={productId} />

      {selectedModels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label={`Modelos selecionados para ${productName}`}>
          {selectedModels.map((model) => (
            <button
              key={model.id}
              type="button"
              title={`Remover ${model.lineLabel} - ${model.label}`}
              onClick={() => toggleModel(model.id)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 text-[11px] font-medium text-emerald-100 transition hover:border-rose-400/45 hover:bg-rose-400/10 hover:text-rose-100"
            >
              {model.lineLabel} - {model.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Nenhum modelo confirmado</p>
      )}

      {suggestedModels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-amber-200">Sugestão: {suggestedModels.map((model) => model.label).join(', ')}</span>
          <button
            type="button"
            onClick={() => applySuggestion(false)}
            className="rounded-md border border-amber-300/25 px-2 py-1 font-medium text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-300/10"
          >
            Adicionar sugestão
          </button>
          <button
            type="button"
            onClick={() => applySuggestion(true)}
            className="rounded-md border border-white/10 px-2 py-1 font-medium text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            Usar somente sugestão
          </button>
        </div>
      ) : null}

      <details className="rounded-md border border-white/8 bg-[#050A14]">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-300 marker:text-slate-500">
          Selecionar modelos ({selectedModelIds.size})
        </summary>
        <div className="max-h-64 overflow-y-auto border-t border-white/8 p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from(modelsByLine.entries()).map(([lineLabel, lineModels]) => (
              <fieldset key={lineLabel} className="rounded border border-white/6 p-2">
                <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {lineLabel}
                </legend>
                <div className="space-y-1">
                  {lineModels.map((model) => (
                    <label
                      key={model.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[11px] text-slate-300 transition hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        name="modelIds"
                        value={model.id}
                        checked={selectedModelIds.has(model.id)}
                        onChange={() => toggleModel(model.id)}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-[#081225] text-[#1E3DFF] focus:ring-[#1E3DFF]/45"
                      />
                      {model.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedModelIds(new Set())}
          disabled={selectedModelIds.size === 0}
          className="h-8 rounded-md border border-white/10 px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-rose-400/45 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Limpar seleção
        </button>
        <button
          type="submit"
          className="h-8 rounded-md border border-[#1E3DFF]/35 bg-[#101F43] px-3 text-[11px] font-semibold text-white transition hover:bg-[#1E3DFF]/30"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}

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
                    <ModelPicker
                      currentModelIds={product.currentModelIds}
                      models={models}
                      productId={product.id}
                      productName={product.name}
                      suggestedModelIds={product.suggestedModelIds}
                    />
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
