'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { ManualProductFields } from '@/modules/catalog/manual-product';
import { saveManualProductAction } from './catalog-actions';

const fieldClass = 'mt-1.5 w-full rounded-lg border border-white/10 bg-[#050A14] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400';
type Result = { ok: boolean; message: string; productId?: string };

export function ProductEditor({ initial }: { initial: ManualProductFields }) {
  const [fields, setFields] = useState(initial);
  const [result, submit, pending] = useActionState<Result | null, FormData>(async (_, form) => {
    try { return await saveManualProductAction(form); }
    catch { return { ok: false, message: 'Não foi possível salvar. Seus dados continuam preenchidos; tente novamente.' }; }
  }, null);
  const created = initial.mode === 'create' && result?.ok;
  function input(key: keyof ManualProductFields, label: string, options: { required?: boolean; maxLength?: number; inputMode?: 'decimal' | 'numeric'; type?: string } = {}) {
    return <label className="block text-xs text-slate-300">{label}<input name={key} value={fields[key]} onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} className={fieldClass} {...options} /></label>;
  }
  return <form action={submit} aria-busy={pending} className="mt-5 max-w-3xl space-y-5">
    <input type="hidden" name="productId" value={fields.productId} /><input type="hidden" name="mode" value={fields.mode} />
    <fieldset disabled={pending || Boolean(created)} className="space-y-5 rounded-xl border border-white/10 bg-[#081225] p-4 sm:p-6">
      <legend className="sr-only">Dados do produto</legend>
      {input('name', 'Nome do produto', { required: true, maxLength: 200 })}
      <label className="block text-xs text-slate-300">Descrição<textarea name="description" value={fields.description} onChange={event => setFields(previous => ({ ...previous, description: event.target.value }))} rows={5} maxLength={10000} className={fieldClass} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        {input('sku', 'SKU / código interno', { maxLength: 80 })}
        <label className="block text-xs text-slate-300">Formato<select name="format" value={fields.format} onChange={event => setFields(previous => ({ ...previous, format: event.target.value as ManualProductFields['format'] }))} className={fieldClass}><option value="physical">Produto físico / livro impresso</option><option value="ebook">E-book / produto digital</option></select></label>
        {input('author', 'Autor (opcional)', { maxLength: 200 })}{input('isbn', 'ISBN (opcional)', { maxLength: 40 })}
        {input('price', 'Preço (R$)', { required: true, inputMode: 'decimal' })}{input('stock', 'Estoque disponível', { required: true, inputMode: 'numeric' })}
        {input('category', 'Categoria (opcional)', { maxLength: 80 })}
        <label className="block text-xs text-slate-300">Publicação<select name="status" value={fields.status} onChange={event => setFields(previous => ({ ...previous, status: event.target.value as ManualProductFields['status'] }))} className={fieldClass}><option value="draft">Rascunho</option><option value="active">Publicado</option><option value="inactive">Oculto</option></select></label>
      </div>
      <p className="text-xs leading-5 text-slate-400">A categoria informada é criada nesta loja, se ainda não existir. Publicado aparece na vitrine somente quando a loja estiver ativa.</p>
      {input('imageUrl', 'Link da capa / imagem (HTTPS)', { type: 'url', maxLength: 1024 })}
      <p className="text-xs text-slate-400">Use uma imagem PNG, JPG, WebP ou AVIF. Sem link, o produto usa a imagem padrão do catálogo.</p>
      <details className="rounded-lg border border-white/8 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-300">Peso e medidas para envio (opcional)</summary><div className="mt-4 grid grid-cols-2 gap-4">{input('weight', 'Peso (kg)', { inputMode: 'decimal' })}{input('width', 'Largura (cm)', { inputMode: 'decimal' })}{input('height', 'Altura (cm)', { inputMode: 'decimal' })}{input('depth', 'Comprimento (cm)', { inputMode: 'decimal' })}</div></details>
      {fields.format === 'ebook' ? <p className="text-xs text-amber-100">Este cadastro não envia arquivos digitais ao comprador. A entrega do e-book precisa ser organizada separadamente.</p> : null}
      <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{pending ? 'Salvando…' : initial.mode === 'create' ? 'Cadastrar produto' : 'Salvar produto'}</button>
    </fieldset>
    {result ? <p role={result.ok ? 'status' : 'alert'} className={`rounded-lg border p-4 text-sm ${result.ok ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-100' : 'border-rose-400/20 bg-rose-400/5 text-rose-100'}`}>{result.message}{result.ok ? <Link href={`/admin/produtos?record=${result.productId}`} className="ml-3 font-semibold underline">Ver no catálogo →</Link> : null}</p> : null}
    <Link href="/admin/produtos" className="inline-block text-xs text-blue-300 hover:underline">← Voltar aos produtos</Link>
  </form>;
}
