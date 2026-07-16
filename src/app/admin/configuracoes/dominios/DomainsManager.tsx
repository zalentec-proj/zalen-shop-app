'use client';

import { useActionState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Clock3,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { DomainActionResult, StoreDomain } from '@/modules/domains/domain.types';
import { manageCustomDomainAction } from './actions';

const initialState: DomainActionResult = { ok: true, message: '' };

const statusLabels: Record<StoreDomain['status'], string> = {
  pending_provisioning: 'Provisionando',
  pending_ownership: 'Aguardando propriedade',
  pending_dns: 'Aguardando DNS',
  pending_ssl: 'Aguardando SSL',
  ready: 'Pronto para ativar',
  active: 'Domínio principal',
  redirect: 'Redirecionamento 308',
  failed: 'Falha recuperável',
  removing: 'Removendo',
  removed: 'Removido',
};

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
      className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
      aria-label={`Copiar ${value}`}
    >
      <Clipboard className="h-3 w-3" /> Copiar
    </button>
  );
}

function Timeline({ domain }: { domain: StoreDomain }) {
  const steps = [
    {
      label: 'Provisionamento',
      done: domain.status !== 'pending_provisioning' && domain.status !== 'failed',
    },
    { label: 'Propriedade', done: Boolean(domain.verifiedAt) },
    {
      label: 'DNS',
      done: ['pending_ssl', 'ready', 'active', 'redirect'].includes(domain.status),
    },
    { label: 'SSL', done: ['ready', 'active', 'redirect'].includes(domain.status) },
    { label: 'Ativação', done: ['active', 'redirect'].includes(domain.status) },
  ];

  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {steps.map((step) => (
        <li
          key={step.label}
          className="flex items-center gap-2 rounded-md border border-white/6 bg-[#071020] px-2 py-2 text-[10px] text-slate-300"
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${step.done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
            {step.done ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

export function DomainsManager({
  storeName,
  platformHostname,
  currentHost,
  domains,
  canManage,
  featureAvailable,
}: {
  storeName: string;
  platformHostname: string;
  currentHost: string;
  domains: StoreDomain[];
  canManage: boolean;
  featureAvailable: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageCustomDomainAction,
    initialState
  );
  const visibleDomains = domains.filter((domain) => domain.status !== 'removed');

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/8 bg-[#0B1933]">
        <div className="border-b border-white/6 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Endereços da loja</h2>
              <p className="mt-1 text-xs text-slate-400">
                {storeName} mantém o subdomínio Zalen como fallback administrativo e público.
              </p>
            </div>
            <span className="rounded-md border border-blue-400/25 bg-blue-400/10 px-2 py-1 text-[10px] font-medium text-blue-200">
              {featureAvailable ? 'Autosserviço disponível' : 'Rollout desativado'}
            </span>
          </div>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/6 bg-[#071020] p-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Host atual</div>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-white"><Globe2 className="h-3.5 w-3.5 text-sky-300" />{currentHost}</div>
          </div>
          <div className="rounded-lg border border-white/6 bg-[#071020] p-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Subdomínio Zalen</div>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />{platformHostname}</div>
          </div>
        </div>
      </section>

      {!featureAvailable && (
        <div className="flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          O recurso está publicado com a flag desligada. Configure as variáveis server-side e inclua esta loja na allowlist para iniciar o piloto.
        </div>
      )}

      {canManage && featureAvailable ? (
        <form action={action} className="rounded-xl border border-white/8 bg-[#0B1933] p-4">
          <input type="hidden" name="intent" value="register" />
          <h2 className="text-sm font-semibold text-white">Cadastrar domínio já adquirido</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Informe apenas o endereço. A Zalen não compra o domínio nem altera DNS ou e-mail no seu registrador.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
            <label className="min-w-0 text-xs text-slate-300">
              Domínio
              <input
                name="hostname"
                required
                placeholder="www.sualoja.com.br"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400/50"
              />
            </label>
            <fieldset className="rounded-lg border border-white/8 bg-[#071020] px-3 py-2">
              <legend className="px-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">Principal para raiz + www</legend>
              <div className="flex gap-4 py-1 text-xs text-slate-300">
                <label className="flex items-center gap-2"><input type="radio" name="preferredPrimary" value="www" defaultChecked /> www</label>
                <label className="flex items-center gap-2"><input type="radio" name="preferredPrimary" value="apex" /> raiz</label>
              </div>
            </fieldset>
            <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-primary px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />} Cadastrar
            </button>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-amber-200/80"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Se o apex já atende site, e-mail ou outra infraestrutura, não altere o A record antes de revisar o impacto.</p>
        </form>
      ) : !canManage ? (
        <div className="flex gap-3 rounded-lg border border-white/8 bg-[#0B1933] p-3 text-xs text-slate-300"><LockKeyhole className="h-4 w-4 text-sky-300" />Seu papel permite acompanhar status e DNS, mas somente dono, admin da loja ou papel global pode alterar.</div>
      ) : null}

      {state.message && (
        <div className={`rounded-lg border p-3 text-xs ${state.ok ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-100' : 'border-rose-300/20 bg-rose-300/8 text-rose-100'}`}>
          {state.message}
        </div>
      )}

      <div className="space-y-3">
        {visibleDomains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#071020] p-8 text-center text-xs text-slate-400">Nenhum domínio próprio cadastrado.</div>
        ) : visibleDomains.map((domain) => {
          const records = [...domain.verificationRecords, ...domain.dnsRecords];
          return (
            <article key={domain.id} className="rounded-xl border border-white/8 bg-[#0B1933] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{domain.hostname}</h3>
                    <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">{statusLabels[domain.status]}</span>
                    <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">{domain.role === 'primary' ? 'Principal' : 'Redirect'}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Última verificação: {domain.lastCheckedAt ? new Date(domain.lastCheckedAt).toLocaleString('pt-BR') : 'ainda não executada'}</p>
                </div>
                {domain.lastErrorCode && <span className="rounded bg-rose-400/10 px-2 py-1 text-[10px] text-rose-200">{domain.lastErrorCode}</span>}
              </div>

              <div className="mt-4"><Timeline domain={domain} /></div>

              {records.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-white/6">
                  <table className="w-full min-w-[660px] text-left text-[11px]">
                    <thead className="bg-[#071020] text-slate-500"><tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Valor exato informado pela Vercel</th><th className="px-3 py-2">Finalidade</th></tr></thead>
                    <tbody>{records.map((record, index) => <tr key={`${record.type}-${record.name}-${index}`} className="border-t border-white/6 text-slate-200"><td className="px-3 py-2 font-mono">{record.type}</td><td className="px-3 py-2"><div className="flex items-center gap-2"><span className="font-mono">{record.name}</span><CopyButton value={record.name} /></div></td><td className="px-3 py-2"><div className="flex items-center gap-2"><span className="max-w-[360px] truncate font-mono">{record.value}</span><CopyButton value={record.value} /></div></td><td className="px-3 py-2 text-slate-400">{record.purpose === 'ownership' ? 'Propriedade' : 'Roteamento'}</td></tr>)}</tbody>
                  </table>
                </div>
              )}

              {canManage && featureAvailable && domain.status !== 'removing' && (
                <div className="mt-4 flex flex-wrap items-start gap-2">
                  {!['active', 'redirect'].includes(domain.status) && <form action={action}><input type="hidden" name="intent" value="verify" /><input type="hidden" name="domainId" value={domain.id} /><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200"><RefreshCw className="h-3.5 w-3.5" />Verificar agora</button></form>}
                  {domain.status === 'failed' && <form action={action}><input type="hidden" name="intent" value="retry" /><input type="hidden" name="domainId" value={domain.id} /><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 px-3 py-2 text-xs text-amber-100">Tentar novamente</button></form>}
                  {['ready', 'redirect'].includes(domain.status) && <form action={action} onSubmit={(event) => { if (!window.confirm(`Ativar ${domain.hostname} como domínio principal?`)) event.preventDefault(); }}><input type="hidden" name="intent" value="activate" /><input type="hidden" name="confirmed" value="yes" /><input type="hidden" name="domainId" value={domain.id} /><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100">{domain.status === 'redirect' ? 'Tornar principal' : 'Ativar domínio'}</button></form>}
                  <details className="rounded-lg border border-rose-300/15 px-3 py-2 text-xs text-rose-100"><summary className="cursor-pointer list-none"><span className="inline-flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" />Remover</span></summary><form action={action} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="intent" value="remove" /><input type="hidden" name="domainId" value={domain.id} /><input name="confirmation" required placeholder={`Digite ${domain.hostname}`} className="min-w-[260px] flex-1 rounded border border-rose-300/20 bg-[#071020] px-3 py-2 text-white" /><button disabled={pending} className="rounded bg-rose-500/15 px-3 py-2 font-semibold">Confirmar remoção</button><p className="w-full text-[10px] leading-4 text-slate-400">Remove apenas a associação com o projeto Vercel; não apaga o domínio nem outros registros DNS.</p></form></details>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
