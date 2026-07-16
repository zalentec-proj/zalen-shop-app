import type { Metadata } from 'next';
import { enforceCanonicalStorefrontHost } from '@/modules/stores/storefront-canonical';
import './globals.css';

export const metadata: Metadata = {
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
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await enforceCanonicalStorefrontHost();

  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
