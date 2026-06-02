import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: `Login — ${platformBrand.name}`,
  description: 'Acesse o painel operacional da Zalen Shop.',
};

export default function LoginPage() {
  return <LoginClient />;
}
