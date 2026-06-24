import type { Metadata } from 'next';
import Link from 'next/link';
import App from '@/App';
import { listStorefrontProducts } from '@/modules/catalog/product.service';
import { toStorefrontProducts } from '@/modules/catalog/storefront-product.adapter';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) {
    return {
      title: 'Loja não encontrada — Zalen Shop',
      description: 'Este endereço de loja não está ativo na Zalen Shop.',
    };
  }

  return {
    title: `${store.name} — Drones e Peças DJI`,
    description:
      'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
    openGraph: {
      type: 'website',
      title: `${store.name} — Drones e Peças DJI`,
      description:
        'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
      siteName: store.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${store.name} — Drones e Peças DJI`,
      description:
        'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
    },
  };
}

function StoreNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A1730]/90 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
          Loja não encontrada
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Este endereço não está ativo
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Verifique o subdomínio da loja ou acesse o painel pela Zalen Shop.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-blue-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2f68ff]"
        >
          Ir para o login
        </Link>
      </section>
    </main>
  );
}

export default async function HomePage() {
  const resolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(resolution);

  if (!store) {
    return <StoreNotFound />;
  }

  const products = toStorefrontProducts(
    await listStorefrontProducts(store.id)
  );

  return <App products={products} />;
}
