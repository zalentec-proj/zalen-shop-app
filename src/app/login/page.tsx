import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { getLoginNavigationContext } from '@/modules/auth/login-destination.service';
import { getSafeLoginNextTarget } from '@/modules/auth/login-navigation';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: `Login — ${platformBrand.name}`,
  description: 'Acesse o painel operacional da Zalen Shop.',
  ...noindexMetadata,
};

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const { requestOrigin, rootDomain } = await getLoginNavigationContext();
  return <LoginClient nextPath={getSafeLoginNextTarget(params?.next, requestOrigin, rootDomain)} />;
}
