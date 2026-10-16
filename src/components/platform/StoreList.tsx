import { ArrowUpRight, Store } from 'lucide-react';
import type { StoreRow } from '@/modules/stores/store.types';
import { getStoreAdminUrl } from '@/modules/auth/operational-navigation';

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  planned: 'Em preparação',
  inactive: 'Inativa',
};

export function StoreList({ stores, requestOrigin, rootDomain, adminPath = '/admin' }: {
  stores: StoreRow[];
  requestOrigin: string;
  rootDomain: string;
  adminPath?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#081225]">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Lojas e acesso aos seus painéis operacionais</caption>
        <thead className="border-b border-white/8 bg-white/[0.02] text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 sm:px-5">Loja</th>
            <th scope="col" className="px-3 py-3">Status</th>
            <th scope="col" className="px-4 py-3 text-right sm:px-5">Painel</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {stores.map((store) => {
            const adminUrl = store.status === 'active'
              ? getStoreAdminUrl(store.slug, requestOrigin, rootDomain, adminPath)
              : null;
            return (
              <tr key={store.id} className="transition hover:bg-white/[0.02]">
                <th scope="row" className="px-4 py-4 font-normal sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/3 text-slate-400 sm:inline-flex">
                      <Store className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100">{store.name}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{store.slug}</p>
                    </div>
                  </div>
                </th>
                <td className="px-3 py-4">
                  <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${store.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-400'}`}>
                    {statusLabels[store.status] ?? 'Indisponível'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right sm:px-5">
                  {adminUrl ? (
                    <a
                      href={adminUrl}
                      aria-label={`Abrir painel de ${store.name}`}
                      className="inline-flex items-center justify-end gap-1.5 text-xs font-semibold text-blue-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
                    >
                      Abrir painel
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">Indisponível</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
