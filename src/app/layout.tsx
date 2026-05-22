import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brasil Drones & Parts — Drones e Peças DJI',
  description:
    'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
  openGraph: {
    type: 'website',
    url: 'https://brasil-drones.vercel.app/',
    title: 'Brasil Drones & Parts — Drones e Peças DJI',
    description:
      'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
    images: [
      {
        url: 'https://brasil-drones.vercel.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'pt_BR',
    siteName: 'Brasil Drones & Parts',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brasil Drones & Parts — Drones e Peças DJI',
    description:
      'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.',
    images: ['https://brasil-drones.vercel.app/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
