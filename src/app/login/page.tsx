import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: `Login — ${platformBrand.name}`,
  description: 'Acesse o painel operacional da Zalen Shop.',
};

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string;
  }>;
}

function getSafeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/admin';
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginClient nextPath={getSafeNextPath(params?.next)} />;
}
