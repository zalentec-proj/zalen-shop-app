'use client';
import { useActionState, useState, type ReactNode } from 'react';
import { createStoreAction, publishStoreAction, saveStoreAction } from '@/app/platform/lojas/actions';
import type { PlatformActionState } from '@/modules/platform/store-management.schema';
import type { StorePresentation } from '@/modules/storefront/presentation';

const inputClass = 'w-full rounded-lg border border-white/10 bg-[#050c19] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400';
const buttonClass = 'rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50';
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="grid gap-2 text-xs text-slate-300">{label}{children}{hint ? <span className="text-[11px] leading-5 text-slate-500">{hint}</span> : null}</label>;
}
function Feedback({ state }: { state: PlatformActionState }) {
  return state.message ? <p role={state.ok ? 'status' : 'alert'} className={`rounded-lg border p-3 text-sm ${state.ok ? 'border-emerald-400/20 text-emerald-200' : 'border-amber-400/20 text-amber-200'}`}>{state.message}</p> : null;
}

export function NewStoreForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(createStoreAction, {});
  return <form action={action} className="grid gap-5 rounded-xl border border-white/10 bg-[#081225] p-5 sm:p-6">
    <input type="hidden" name="requestId" value={requestId} />
    <Field label="Nome da loja"><input name="name" required minLength={2} maxLength={100} className={inputClass} autoComplete="organization" /></Field>
    <Field label="Endereço da loja" hint="Use letras minúsculas, números e hífens. O endereço fica fixo após o cadastro."><input name="slug" required minLength={3} maxLength={50} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="minha-loja" className={inputClass} autoCapitalize="none" spellCheck={false} /></Field>
    <Field label="E-mail do responsável" hint="A conta já deve existir no Supabase Auth da Zalen Shop. O cadastro concede acesso somente a esta loja."><input type="email" name="ownerEmail" required maxLength={254} className={inputClass} autoComplete="email" /></Field>
    <div className="rounded-lg border border-white/8 p-4 text-sm"><p className="font-semibold">Modelo Essencial</p><p className="mt-1 text-xs leading-5 text-slate-400">Vitrine neutra com logo, cores, banner, textos e contatos próprios. A loja começa em preparação, com catálogo vazio.</p></div>
    <Feedback state={state} />
    <button disabled={pending} className={`${buttonClass} justify-self-start`}>{pending ? 'Cadastrando…' : 'Cadastrar e personalizar'}</button>
  </form>;
}

const textFields: Array<{ name: keyof StorePresentation; label: string; max: number; type?: string; hint?: string }> = [
  { name: 'brandName', label: 'Nome público da marca', max: 100 },
  { name: 'logoUrl', label: 'Imagem do logo', max: 1024, hint: 'Endereço HTTPS de imagem PNG, JPG, WebP ou AVIF.' },
  { name: 'faviconUrl', label: 'Ícone do navegador', max: 1024, hint: 'Endereço HTTPS de imagem. SVG não é aceito.' },
  { name: 'bannerUrl', label: 'Imagem do banner da home', max: 1024, hint: 'Endereço HTTPS de imagem. Deixe vazio para uma capa com as cores da loja.' },
  { name: 'heroTitle', label: 'Título da home', max: 120 },
  { name: 'email', label: 'E-mail de atendimento', max: 254, type: 'email' },
  { name: 'phone', label: 'Telefone de atendimento', max: 30 },
  { name: 'whatsapp', label: 'WhatsApp', max: 15, hint: 'Somente números, incluindo país e DDD. Exemplo: 5545999999999.' },
  { name: 'instagramUrl', label: 'Instagram', max: 300, type: 'url' },
  { name: 'seoTitle', label: 'Título para buscadores', max: 100 },
];

export function PresentationForm({ storeId, name, config, revision }: { storeId: string; name: string; config: StorePresentation; revision: number }) {
  const [state, action, pending] = useActionState(saveStoreAction.bind(null, storeId), {});
  const [visualStyle, setVisualStyle] = useState(config.visualStyle);
  return <form action={action} className="grid gap-6 rounded-xl border border-white/10 bg-[#081225] p-5 sm:p-6">
    <input type="hidden" name="revision" value={revision} />
    <input type="hidden" name="renderer" value={config.renderer} />
    <div><h2 className="font-semibold">Identidade da loja</h2><p className="mt-1 text-xs text-slate-400">{config.renderer === 'brasil-drones' ? 'Visual sob medida Brasil Drones' : 'Modelo Essencial'} · Salvar mantém as alterações em rascunho.</p></div>
    <Field label="Nome interno da loja"><input name="name" defaultValue={name} required minLength={2} maxLength={100} className={inputClass} /></Field>
    {config.renderer === 'neutral' ? <section className="grid gap-5 rounded-lg border border-white/10 p-4">
      <Field label="Modelo visual"><select name="visualStyle" value={visualStyle} onChange={(event) => setVisualStyle(event.target.value as StorePresentation['visualStyle'])} className={inputClass}>
        <option value="essential">Essencial — escuro</option><option value="editorial">Editorial — claro, para livros e publicações</option>
      </select></Field>
      <p className="text-xs leading-5 text-slate-400">O modelo Editorial usa fundo claro, títulos serifados e uma capa com imagem ao lado do texto. Os campos abaixo são opcionais.</p>
      <Field label="Mensagem da barra superior"><input name="announcement" defaultValue={config.announcement} maxLength={160} className={inputClass} /></Field>
      <Field label="Chamada acima do título"><input name="heroEyebrow" defaultValue={config.heroEyebrow} maxLength={80} className={inputClass} /></Field>
      <Field label="Trecho do título em destaque" hint="Uma palavra ou trecho do título da home que receberá a cor de destaque."><input name="heroHighlight" defaultValue={config.heroHighlight} maxLength={60} className={inputClass} /></Field>
      <Field label="Temas em destaque" hint="Um tema por linha, até seis. Só viram links quando existir uma categoria correspondente na loja."><textarea name="featuredTopics" defaultValue={config.featuredTopics.join('\n')} maxLength={305} rows={4} className={inputClass} /></Field>
      <Field label="Sobre a editora"><textarea name="aboutText" defaultValue={config.aboutText} maxLength={800} rows={3} className={inputClass} /></Field>
    </section> : <input type="hidden" name="visualStyle" value="essential" />}
    <div className="grid gap-5 sm:grid-cols-2">
      {textFields.map((field) => <Field key={field.name} label={field.label} hint={field.hint}>
        <input name={field.name} type={field.type ?? 'text'} defaultValue={config[field.name]} maxLength={field.max} required={field.name === 'brandName'} className={inputClass} />
      </Field>)}
      <Field label="Cor principal"><input type="color" name="primaryColor" defaultValue={config.primaryColor} className={`${inputClass} h-11`} /></Field>
      <Field label="Cor de destaque"><input type="color" name="accentColor" defaultValue={config.accentColor} className={`${inputClass} h-11`} /></Field>
    </div>
    <Field label="Descrição da home"><textarea name="heroDescription" defaultValue={config.heroDescription} maxLength={500} rows={3} className={inputClass} /></Field>
    <Field label="Texto do rodapé"><textarea name="footerText" defaultValue={config.footerText} maxLength={600} rows={3} className={inputClass} /></Field>
    <Field label="Descrição para buscadores"><textarea name="seoDescription" defaultValue={config.seoDescription} maxLength={300} rows={2} className={inputClass} /></Field>
    <Feedback state={state} />
    <button disabled={pending} className={`${buttonClass} justify-self-start`}>{pending ? 'Salvando…' : 'Salvar rascunho'}</button>
  </form>;
}

export function PublicationForm({ storeId, revision, active }: { storeId: string; revision: number; active: boolean }) {
  const [state, action, pending] = useActionState(publishStoreAction.bind(null, storeId), {});
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="revision" value={revision} />
    <label className="flex items-start gap-2 text-xs text-slate-300"><input type="checkbox" name="confirmed" value="yes" required className="mt-0.5" />Conferi a prévia e confirmo a alteração da disponibilidade pública desta loja.</label>
    <Feedback state={state} />
    <div className="flex flex-wrap gap-3">
      <button name="operation" value="publish" disabled={pending || revision === 0} className={buttonClass}>{pending ? 'Processando…' : active ? 'Publicar rascunho' : 'Publicar e ativar loja'}</button>
      {active ? <button name="operation" value="deactivate" disabled={pending} className="rounded-lg border border-red-400/30 px-4 py-2.5 text-sm text-red-300 disabled:opacity-50">Desativar loja</button> : null}
    </div>
  </form>;
}
