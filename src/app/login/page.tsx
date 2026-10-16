import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/modules/auth/auth.service';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { getLoginNavigationContext, resolveLoginDestination } from '@/modules/auth/login-destination.service';
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
  const user = await getCurrentUser();
  if (user) {
    let destination: string | null;
    try {
      destination = await resolveLoginDestination(user.id, params?.next);
    } catch {
      return <LoginClient accessError="Não foi possível abrir o painel agora. Tente novamente." />;
    }
    redirect(destination ?? '/lojas?acesso=restrito');
  }
  return <LoginClient nextPath={params?.next ? getSafeLoginNextTarget(params.next, requestOrigin, rootDomain) : ''} />;
}
