'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AdminActionForm } from '@/components/admin/AdminActionForm';
import { AdminDrawer } from '@/components/admin/AdminDrawer';
import { saveProductDroneModelsAction } from './actions';

interface ModelOption { id: string; label: string; lineLabel: string }
interface ProductRow { id: string; name: string; sku?: string; status: string; currentModelIds: string[]; suggestedModelIds: string[] }

function ModelPicker({ product, models }: { product: ProductRow; models: ModelOption[] }) {
  const [selected, setSelected] = useState(() => new Set(product.currentModelIds));
  const groups = useMemo(() => models.reduce<Map<string,ModelOption[]>>((map,model)=>{const current=map.get(model.lineLabel)??[];current.push(model);map.set(model.lineLabel,current);return map;},new Map()),[models]);
  const suggestion = product.suggestedModelIds.filter((id)=>!selected.has(id));
  const selectedModels = models.filter((model) => selected.has(model.id));

  return (
    <AdminActionForm
      action={saveProductDroneModelsAction}
      successMessage="Compatibilidade salva com sucesso."
      pendingMessage="Salvando compatibilidade…"
      className="space-y-4"
    >
      <input type="hidden" name="productId" value={product.id} />
      {Array.from(selected).map((modelId) => (
        <input key={modelId} type="hidden" name="modelIds" value={modelId} />
      ))}
      {suggestion.length ? (
        <button
          type="button"
          onClick={() =>
            setSelected((current) =>
              new Set([...current, ...product.suggestedModelIds])
            )
          }
          className="flex w-full items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-left text-xs text-amber-200"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="block">Adicionar sugestão</strong>
            Incluir os modelos detectados no nome sem remover os já selecionados.
          </span>
        </button>
      ) : null}
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {Array.from(groups).map(([line, options]) => (
          <fieldset key={line} className="rounded-lg border border-white/7 p-3">
            <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {line}
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {options.map((model) => {
                const checked = selected.has(model.id);

                return (
                  <label
                    key={model.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-xs transition ${
                      checked
                        ? 'border-blue-400/30 bg-blue-400/10 text-blue-100'
                        : 'border-transparent text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          next.has(model.id)
                            ? next.delete(model.id)
                            : next.add(model.id);
                          return next;
                        })
                      }
                    />
                    {model.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="rounded-lg border border-white/7 bg-[#050A14] px-3 py-2.5">
        <p className="text-xs font-semibold text-white">
          {selectedModels.length === 1
            ? '1 modelo será vinculado'
            : `${selectedModels.length} modelos serão vinculados`}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          {selectedModels.map((model) => model.label).join(' · ') || 'Nenhum modelo selecionado'}
        </p>
      </div>
      <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-60">
        Salvar compatibilidade
      </button>
    </AdminActionForm>
  );
}

export default function CompatibilityManager({ models, products, selectedId, openHrefBase }: { models: ModelOption[]; products: ProductRow[]; selectedId?: string; openHrefBase: string }) {
  const byId=useMemo(()=>new Map(models.map((model)=>[model.id,model])),[models]); const selected=products.find((product)=>product.id===selectedId);
  return <><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-white/7 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Confirmados</th><th className="px-3 py-3">Sugestão</th><th className="px-3 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-white/6">{products.map((product)=>{const current=product.currentModelIds.map((id)=>byId.get(id)?.label).filter(Boolean);const suggested=product.suggestedModelIds.map((id)=>byId.get(id)?.label).filter(Boolean);return <tr key={product.id}><td className="px-3 py-3"><div className="font-semibold text-white">{product.name}</div><div className="mt-1 text-[11px] text-slate-500">{product.sku??'SKU não informado'}</div></td><td className="px-3 py-3 text-slate-300">{current.join(', ')||'Não definido'}</td><td className="px-3 py-3 text-amber-200">{suggested.length?suggested.join(', '):'—'}</td><td className="px-3 py-3 text-right"><Link href={`${openHrefBase}&record=${product.id}`} scroll={false} className="font-semibold text-blue-300">Editar</Link></td></tr>})}</tbody></table></div>{selected?<AdminDrawer title={selected.name} description="Selecione os modelos realmente compatíveis."><ModelPicker key={selected.id} product={selected} models={models}/></AdminDrawer>:null}</>;
}
