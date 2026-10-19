'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ShoppingBag, ShoppingCart, User } from 'lucide-react';
import type { Product, StorefrontCategory } from '@/types';
import type { StorePresentation } from '@/modules/storefront/presentation';
import { useStorefrontIdentity } from '@/modules/storefront/StorefrontIdentity';
import { useStorefrontCart } from '@/modules/cart/StorefrontCartProvider';
import { SafeCatalogImage } from '@/components/ui/SafeCatalogImage';

export function NeutralHeader({ categories, cartItemsCount, onCartToggle, searchQuery, onSearchChange, preview = false }: {
  categories: Array<Pick<StorefrontCategory, 'name' | 'slug'>>; cartItemsCount: number;
  onCartToggle: () => void; searchQuery: string; onSearchChange: (value: string) => void; preview?: boolean;
}) {
  const identity = useStorefrontIdentity();
  return <header className="border-b border-white/10 bg-brand-bg px-5 py-5 text-brand-white">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-5">
      <Link href={preview ? '#' : '/'} className="mr-auto inline-flex max-w-64 items-center text-xl font-semibold">
        {identity?.logoUrl ? <img src={identity.logoUrl} alt={identity.brandName} className="max-h-14 max-w-52 object-contain" /> : identity?.brandName ?? 'Zalen Shop'}
      </Link>
      {!preview ? <><label className="sr-only" htmlFor="neutral-search">Buscar produtos</label><input id="neutral-search" type="search" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Buscar produtos" className="order-last w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-primary sm:order-none sm:w-64" />
      <Link href="/conta" aria-label="Minha conta" className="p-2"><User className="h-5 w-5" /></Link>
      <button onClick={onCartToggle} aria-label={`Abrir carrinho com ${cartItemsCount} itens`} className="inline-flex gap-2 p-2"><ShoppingCart className="h-5 w-5" /><span className="text-xs">{cartItemsCount}</span></button></> : <span className="text-xs text-brand-muted">Prévia privada</span>}
    </div>
    {categories.length ? <nav aria-label="Categorias" className="mx-auto mt-5 flex max-w-7xl gap-5 overflow-x-auto text-sm text-brand-muted">{categories.map((c) => <Link className="shrink-0 hover:text-white" href={preview ? '#' : `/categoria/${c.slug}`} key={c.slug}>{c.name}</Link>)}</nav> : null}
  </header>;
}

export function PresentationHero({ presentation }: { presentation: StorePresentation }) {
  return <section className="relative isolate overflow-hidden border-b border-white/10 bg-blue-primary/15">
    {presentation.bannerUrl ? <img src={presentation.bannerUrl} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" /> : null}
    {presentation.bannerUrl ? <div className="absolute inset-0 -z-10 bg-black/65" /> : null}
    <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
      <p className="text-xs font-semibold uppercase tracking-widest text-green-accent">{presentation.brandName}</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">{presentation.heroTitle || presentation.brandName}</h1>
      {presentation.heroDescription ? <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">{presentation.heroDescription}</p> : null}
      <a href="#catalogo" className="mt-7 inline-flex rounded-lg bg-blue-primary px-5 py-3 text-sm font-semibold text-white">Explorar produtos</a>
    </div>
  </section>;
}

export function NeutralFooter({ categories = [] }: { categories?: Array<Pick<StorefrontCategory, 'name' | 'slug'>> }) {
  const identity = useStorefrontIdentity();
  return <footer id="contato" className="mt-16 border-t border-white/10 bg-brand-bg px-6 py-10 text-brand-white">
    <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-3">
      <div><p className="text-lg font-semibold">{identity?.brandName}</p><p className="mt-3 text-sm leading-6 text-brand-muted">{identity?.footerText}</p></div>
      <div className="grid content-start gap-3 text-sm text-brand-muted"><p className="font-semibold text-white">Navegue</p>{categories.slice(0, 8).map((c) => <Link key={c.slug} href={`/categoria/${c.slug}`}>{c.name}</Link>)}<Link href="/contato">Contato</Link><Link href="/conta">Minha conta</Link></div>
      <div className="grid content-start gap-3 text-sm text-brand-muted"><p className="font-semibold text-white">Atendimento</p>{identity?.email ? <a href={`mailto:${identity.email}`}>{identity.email}</a> : null}{identity?.phone ? <p>{identity.phone}</p> : null}{identity?.whatsapp ? <a href={`https://wa.me/${identity.whatsapp}`} rel="noreferrer" target="_blank">WhatsApp</a> : null}{identity?.instagramUrl ? <a href={identity.instagramUrl} rel="noreferrer" target="_blank">Instagram</a> : null}</div>
    </div>
    <p className="mx-auto mt-9 max-w-7xl border-t border-white/10 pt-5 text-xs text-brand-muted">© {new Date().getFullYear()} {identity?.brandName}. Todos os direitos reservados.</p>
  </footer>;
}

export function NeutralStorefront({ presentation, products, categories, preview = false, initialQuery = '' }: { presentation: StorePresentation; products: Product[]; categories: StorefrontCategory[]; preview?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const visibleProducts = products.filter((p) => p.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const { cart, toggleCart, addCartItem } = useStorefrontCart();
  return <div className="min-h-screen bg-brand-bg text-brand-white">
    <NeutralHeader categories={categories} cartItemsCount={cart.items.reduce((sum, item) => sum + item.quantity, 0)} onCartToggle={toggleCart} searchQuery={query} onSearchChange={setQuery} preview={preview} />
    <main><PresentationHero presentation={presentation} />
      <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-6 px-6 py-12">
        <h2 className="text-2xl font-semibold">Produtos</h2>
        {visibleProducts.length ? <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{visibleProducts.map((p) => <article key={p.id} className="overflow-hidden rounded-xl border border-white/10 bg-brand-card">
          <Link href={preview ? '#' : `/produto/${p.id}`}><SafeCatalogImage src={p.image} alt={p.name} className="aspect-square w-full object-contain p-4" /><h3 className="px-4 text-sm font-semibold">{p.name}</h3></Link>
          <div className="p-4"><p className="text-lg font-semibold">{p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          {!preview && p.catalogProductId && p.variantId && p.isAvailable ? <button onClick={() => addCartItem({ productId: p.catalogProductId!, variantId: p.variantId!, name: p.name, imageUrl: p.image, unitPrice: p.price, quantity: 1, sku: p.sku })} className="mt-4 w-full rounded-lg bg-blue-primary px-3 py-2 text-sm font-semibold">Adicionar ao carrinho</button> : null}</div>
        </article>)}</div> : <div className="mt-7 rounded-xl border border-dashed border-white/15 px-6 py-12 text-center"><ShoppingBag className="mx-auto mb-4 h-8 w-8 text-brand-muted" /><p className="text-sm text-brand-muted">{query ? 'Nenhum produto encontrado.' : 'Em breve, novidades por aqui.'}</p></div>}
      </section>
    </main>
    <NeutralFooter categories={categories} />
  </div>;
}
