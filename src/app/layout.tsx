import type { Metadata } from 'next';
import { WhatsAppFloatingButton } from '@/components/storefront/WhatsAppFloatingButton';
import { enforceCanonicalStorefrontHost } from '@/modules/stores/storefront-canonical';
import { StorefrontCartProvider } from '@/modules/cart/StorefrontCartProvider';
import { StorefrontIdentity } from '@/modules/storefront/StorefrontIdentity';
import { getRequestPresentation } from '@/modules/storefront/presentation.repository';
import './globals.css';
import '@/components/storefront/editorial.css';

const platformMetadata: Metadata = {
  title: 'Zalen Shop',
  description:
    'Plataforma Zalen Shop para lojas, produtos, pedidos e integrações.',
  openGraph: {
    type: 'website',
    url: 'https://app.zalenshop.com.br/',
    title: 'Zalen Shop',
    description:
      'Plataforma Zalen Shop para lojas, produtos, pedidos e integrações.',
    locale: 'pt_BR',
    siteName: 'Zalen Shop',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zalen Shop',
    description:
      'Plataforma Zalen Shop para lojas, produtos, pedidos e integrações.',
  },
  icons: {
    icon: '/brand/zalen-store-icon.svg',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const presentation = await getRequestPresentation();
  if (!presentation) return platformMetadata;
  const title = presentation.seoTitle || presentation.brandName;
  const description = presentation.seoDescription || undefined;
  return {
    ...platformMetadata,
    title: { default: title, template: `%s — ${presentation.brandName}` },
    description,
    icons: { icon: presentation.faviconUrl || (presentation.renderer === 'brasil-drones' ? '/favicon.svg' : '/brand/zalen-store-icon.svg') },
    openGraph: { title, description, siteName: presentation.brandName },
    twitter: { title, description },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await enforceCanonicalStorefrontHost();
  const presentation = await getRequestPresentation();

  return (
    <html lang="pt-BR">
      <body>
        <StorefrontIdentity presentation={presentation}>
          <StorefrontCartProvider>
            {children}
            <WhatsAppFloatingButton />
          </StorefrontCartProvider>
        </StorefrontIdentity>
      </body>
    </html>
  );
}
