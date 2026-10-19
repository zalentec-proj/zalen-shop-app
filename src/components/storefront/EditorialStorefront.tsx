'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Headphones, Instagram, Leaf, LibraryBig, Menu, Search, ShoppingCart, Tablet, UserRound, Users, X } from 'lucide-react';
import type { Product, StorefrontCategory } from '@/types';
import type { StorePresentation } from '@/modules/storefront/presentation';
import { useStorefrontIdentity } from '@/modules/storefront/StorefrontIdentity';
import { useStorefrontCart } from '@/modules/cart/StorefrontCartProvider';
import { SafeCatalogImage } from '@/components/ui/SafeCatalogImage';

type CategoryLink = Pick<StorefrontCategory, 'name' | 'slug'>;
const normalizeTopic = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function FaithIcon({ strokeWidth = 1.4 }: { strokeWidth?: number }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M5 8h14" /></svg>;
}
const topicIcons = [FaithIcon, Users, Leaf, Tablet, GraduationCap, BookOpen];
const benefits = [
  { icon: BookOpen, title: 'Curadoria editorial', description: 'Conteúdo que inspira' },
  { icon: Leaf, title: 'Leituras para a vida', description: 'Ideias e novas perspectivas' },
  { icon: LibraryBig, title: 'Novos capítulos', description: 'Histórias para acompanhar você' },
  { icon: Headphones, title: 'Perto de você', description: 'Conheça a editora' },
];

function EditorialBrand() {
  const identity = useStorefrontIdentity();
  return identity?.logoUrl
    ? <img src={identity.logoUrl} alt={identity.brandName} width={250} height={70} className="editorial-logo" />
    : <span className="editorial-wordmark">{identity?.brandName}</span>;
}

export function EditorialHeader({ categories, cartItemsCount, onCartToggle, searchQuery, onSearchChange, preview = false }: {
  categories: CategoryLink[]; cartItemsCount: number; onCartToggle: () => void;
  searchQuery: string; onSearchChange: (value: string) => void; preview?: boolean;
}) {
  const identity = useStorefrontIdentity();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const hasTopics = !!(categories.length || identity?.featuredTopics.length);
  const home = preview ? '#' : '/';
  return <header className="editorial-header" onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); setSearchOpen(false); } }}>
    {identity?.announcement ? <div className="editorial-announcement"><div className="editorial-container">
      <p><BookOpen aria-hidden="true" size={15} />{identity.announcement}</p>
      {identity.instagramUrl ? <a href={identity.instagramUrl} target="_blank" rel="noreferrer" aria-label={`Instagram de ${identity.brandName}`}><Instagram size={16} /></a> : null}
    </div></div> : null}
    <div className="editorial-container editorial-header-main">
      <Link href={home} aria-label={`${identity?.brandName} — início`} className="editorial-brand"><EditorialBrand /></Link>
      <nav id="editorial-navigation" aria-label="Navegação da editora" className={`editorial-nav ${menuOpen ? 'is-open' : ''}`}>
        <Link href={home}>Início</Link><a href={preview ? '#' : '/#catalogo'}>Loja</a>
        {hasTopics ? <a href={preview ? '#' : '/#categorias'}>Categorias</a> : null}
        {identity?.aboutText ? <a href={preview ? '#' : '/#sobre'}>A editora</a> : null}
        <a href={preview ? '#' : '/#contato'}>Contato</a>
      </nav>
      <div className="editorial-header-actions">
        <button type="button" aria-label="Buscar publicações" aria-expanded={searchOpen} aria-controls="editorial-search" onClick={() => setSearchOpen(!searchOpen)}><Search /></button>
        <Link href={preview ? '#' : '/conta'} aria-label="Minha conta"><UserRound /></Link>
        <button type="button" onClick={onCartToggle} aria-label={`Abrir carrinho com ${cartItemsCount} itens`} className="editorial-cart"><ShoppingCart /><span>{cartItemsCount}</span></button>
        <button type="button" className="editorial-menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="editorial-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </div>
    {searchOpen ? <div className="editorial-container editorial-search" id="editorial-search"><label htmlFor="editorial-search-input">Encontre sua próxima leitura</label><input id="editorial-search-input" type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar por título ou assunto" /></div> : null}
  </header>;
}

function HighlightedTitle({ title, highlight }: { title: string; highlight: string }) {
  const index = highlight ? title.indexOf(highlight) : -1;
  return <>{index < 0 ? title : <>{title.slice(0, index)}<span>{title.slice(index, index + highlight.length)}</span>{title.slice(index + highlight.length)}</>}</>;
}

function EditorialHero({ presentation }: { presentation: StorePresentation }) {
  return <section className="editorial-hero">
    <div className="editorial-container editorial-hero-layout">
      <div className="editorial-hero-copy">
        {presentation.heroEyebrow ? <p className="editorial-eyebrow">{presentation.heroEyebrow}</p> : null}
        <h1><HighlightedTitle title={presentation.heroTitle || presentation.brandName} highlight={presentation.heroHighlight} /></h1>
        {presentation.heroDescription ? <p className="editorial-hero-description">{presentation.heroDescription}</p> : null}
        <div className="editorial-hero-actions"><a href="#catalogo" className="editorial-button">Explorar a loja <ArrowRight size={16} /></a>{presentation.featuredTopics.length ? <a href="#categorias" className="editorial-button editorial-button-outline">Ver categorias</a> : null}</div>
        <div className="editorial-hero-notes"><span><BookOpen /><span><strong>Livros e conhecimento</strong><small>Novos caminhos para descobrir</small></span></span><span><Leaf /><span><strong>Curadoria editorial</strong><small>Conteúdo que inspira</small></span></span></div>
      </div>
      {presentation.bannerUrl ? <figure className="editorial-hero-figure"><img src={presentation.bannerUrl} width={800} height={600} alt="Livros e leitor digital em uma composição editorial" loading="eager" /><figcaption>Imagem de ambientação · capas ilustrativas</figcaption></figure> : <div className="editorial-hero-no-image" aria-hidden="true"><BookOpen size={150} strokeWidth={0.7} /></div>}
    </div>
  </section>;
}

function EditorialTopics({ topics, categories, preview }: { topics: string[]; categories: CategoryLink[]; preview: boolean }) {
  if (!topics.length && !categories.length) return null;
  const labels = topics.length ? topics : categories.slice(0, 6).map((category) => category.name);
  return <section id="categorias" className="editorial-container editorial-topics">
    <div className="editorial-section-heading"><h2>Explore por categoria</h2><p>Encontre sua próxima leitura.</p></div>
    <div className="editorial-topics-grid">{labels.map((label, index) => {
      const Icon = topicIcons[index % topicIcons.length];
      const category = categories.find((item) => normalizeTopic(item.name) === normalizeTopic(label) || normalizeTopic(item.slug) === normalizeTopic(label));
      const content = <><span className="editorial-topic-icon"><Icon strokeWidth={1.4} /></span><span>{label}</span></>;
      return category ? <Link key={label} className="editorial-topic" href={preview ? '#' : `/categoria/${category.slug}`}>{content}</Link> : <div key={label} className="editorial-topic">{content}</div>;
    })}</div>
  </section>;
}

export function EditorialFooter({ categories = [] }: { categories?: CategoryLink[] }) {
  const identity = useStorefrontIdentity();
  if (!identity) return null;
  return <footer id="contato" className="editorial-footer"><div className="editorial-container editorial-footer-grid">
    <div><EditorialBrand />{identity.footerText ? <p>{identity.footerText}</p> : null}{identity.instagramUrl ? <a className="editorial-social" href={identity.instagramUrl} target="_blank" rel="noreferrer" aria-label={`Instagram de ${identity.brandName}`}><Instagram size={20} /></a> : null}</div>
    <div><h3>Explore</h3><Link href="/">Início</Link><a href="/#catalogo">Loja</a>{identity.featuredTopics.length || categories.length ? <a href="/#categorias">Categorias</a> : null}{identity.aboutText ? <a href="/#sobre">A editora</a> : null}<Link href="/contato">Contato</Link></div>
    <div><h3>Atendimento</h3><Link href="/conta">Minha conta</Link><Link href="/conta/pedidos">Meus pedidos</Link>{identity.email ? <a className="editorial-contact-address" href={`mailto:${identity.email}`}>{identity.email}</a> : null}{identity.phone ? <p>{identity.phone}</p> : null}{identity.whatsapp ? <a href={`https://wa.me/${identity.whatsapp}`} target="_blank" rel="noreferrer">Fale conosco</a> : null}<Link href="/politica-de-privacidade">Política de privacidade</Link><Link href="/termos-de-uso">Termos e condições</Link></div>
    <div><h3>Publicações</h3>{categories.length ? categories.slice(0, 6).map((category) => <Link key={category.slug} href={`/categoria/${category.slug}`}>{category.name}</Link>) : identity.featuredTopics.map((topic) => <p key={topic}>{topic}</p>)}</div>
  </div><div className="editorial-container editorial-copyright">© {new Date().getFullYear()} {identity.brandName}. Todos os direitos reservados.</div></footer>;
}

export function EditorialStorefront({ presentation, products, categories, preview = false, initialQuery = '' }: {
  presentation: StorePresentation; products: Product[]; categories: StorefrontCategory[]; preview?: boolean; initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const { cart, toggleCart } = useStorefrontCart();
  const term = query.trim().toLocaleLowerCase('pt-BR');
  const visibleProducts = products.filter((product) => `${product.name} ${product.category}`.toLocaleLowerCase('pt-BR').includes(term));
  return <div className="editorial-storefront">
    <EditorialHeader categories={categories} cartItemsCount={cart.items.reduce((sum, item) => sum + item.quantity, 0)} onCartToggle={toggleCart} searchQuery={query} onSearchChange={setQuery} preview={preview} />
    <main><EditorialHero presentation={presentation} /><EditorialTopics topics={presentation.featuredTopics} categories={categories} preview={preview} />
      <section id="catalogo" className="editorial-container editorial-catalog">
        <div className="editorial-catalog-heading"><h2>{term ? 'Sua próxima leitura' : 'Destaques da editora'}</h2>{visibleProducts.length ? <span>{visibleProducts.length} {visibleProducts.length === 1 ? 'publicação' : 'publicações'}</span> : null}</div>
        {visibleProducts.length ? <div className="editorial-products">{visibleProducts.map((product) => <article key={product.id} className="editorial-product">
          <Link href={preview ? '#' : `/produto/${product.id}`} className="editorial-product-cover"><SafeCatalogImage src={product.image} alt={product.name} className="h-full w-full object-contain" /></Link>
          <h3><Link href={preview ? '#' : `/produto/${product.id}`}>{product.name}</Link></h3>{product.category ? <p>{product.category}</p> : null}
          <strong className="editorial-product-price">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><Link href={preview ? '#' : `/produto/${product.id}`} className="editorial-button">Conhecer a publicação</Link>
        </article>)}</div> : <div className="editorial-empty"><BookOpen size={42} strokeWidth={1.2} /><div><h3>{term ? 'Nenhuma publicação encontrada.' : 'O próximo capítulo está sendo preparado.'}</h3><p>{term ? 'Tente buscar por outro título ou assunto.' : 'Em breve, nossas publicações estarão por aqui.'}</p></div></div>}
      </section>
      <section className="editorial-container editorial-benefits" aria-label="Leituras e conhecimento">{benefits.map(({ icon: Icon, title, description }) => <div key={title}><Icon strokeWidth={1.3} /><span><strong>{title}</strong><small>{description}</small></span></div>)}</section>
      {presentation.aboutText ? <section id="sobre" className="editorial-container editorial-about"><span className="editorial-about-icon"><BookOpen strokeWidth={1.2} /></span><div><p className="editorial-kicker">{presentation.brandName}</p><h2>Histórias que inspiram.</h2><p>{presentation.aboutText}</p></div><a href="#catalogo" className="editorial-button editorial-button-outline">Conheça o catálogo <ArrowRight size={16} /></a></section> : null}
    </main><EditorialFooter categories={categories} />
  </div>;
}
