import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { StoreList } from '@/components/platform/StoreList';
import { getLoginNavigationContext } from '@/modules/auth/login-destination.service';
import { listPlatformStores, PLATFORM_STORES_PAGE_SIZE } from '@/modules/platform/platform-stores.repository';

export const metadata: Metadata = { title: 'Lojas — Zalen Shop' };

export default async function PlatformStoresPage({ searchParams }: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  // The repository checks global access before obtaining the privileged client.
  const result = await listPlatformStores(params?.q, params?.page);
  const { requestOrigin, rootDomain } = await getLoginNavigationContext();
  const pages = Math.max(1, Math.ceil(result.total / PLATFORM_STORES_PAGE_SIZE));
  const pageUrl = (page: number) => `/platform/lojas?${new URLSearchParams({ ...(result.query ? { q: result.query } : {}), page: String(page) })}`;

  return (
    <>
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-blue-300">Zalen Shop</p>
        <h1 className="text-2xl font-semibold tracking-tight">Lojas</h1>
        <p className="mt-2 text-sm text-slate-400">Consulte as lojas da plataforma e acesse a operação de cada uma.</p>
      </div>
      <form action="/platform/lojas" className="mb-5 flex flex-wrap items-end gap-2">
        <label className="grid w-full max-w-sm gap-1.5 text-xs text-slate-400" htmlFor="store-search">
          Buscar pelo nome da loja
          <input id="store-search" type="search" name="q" defaultValue={result.query} maxLength={80} placeholder="Nome da loja" className="rounded-lg border border-white/10 bg-[#081225] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400" />
        </label>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
          <Search className="h-4 w-4" aria-hidden="true" />Buscar
        </button>
        {result.query ? <Link href="/platform/lojas" className="px-3 py-2.5 text-sm text-slate-400 hover:text-white">Limpar busca</Link> : null}
      </form>
      {!result.available ? (
        <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
          <h2 className="text-sm font-semibold text-amber-100">Não foi possível carregar as lojas</h2>
          <p className="mt-2 text-sm text-slate-400">Tente novamente em instantes.</p>
          <Link href={pageUrl(result.page)} className="mt-3 inline-block text-sm text-blue-300 underline">Tentar novamente</Link>
        </div>
      ) : (
        <>
          <p role="status" className="mb-3 text-xs text-slate-400">{result.total} {result.total === 1 ? 'loja encontrada' : 'lojas encontradas'}</p>
          {result.stores.length ? (
            <StoreList stores={result.stores} requestOrigin={requestOrigin} rootDomain={rootDomain} />
          ) : (
            <div className="rounded-xl border border-white/8 bg-[#081225] p-8 text-center text-sm text-slate-400">
              {result.query ? 'Nenhuma loja corresponde à busca.' : result.page > 1 ? 'Nenhuma loja nesta página.' : 'Nenhuma loja cadastrada.'}
            </div>
          )}
          {pages > 1 || result.page > 1 ? (
            <nav aria-label="Paginação das lojas" className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>Página {result.page} · {result.total} lojas</span>
              <div className="flex gap-4">
                {result.page > 1 ? <Link href={pageUrl(result.page - 1)} className="text-blue-300 hover:underline">Anterior</Link> : null}
                {result.page < pages ? <Link href={pageUrl(result.page + 1)} className="text-blue-300 hover:underline">Próxima</Link> : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
