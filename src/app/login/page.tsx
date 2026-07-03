import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import {
  isLocalhostName,
  normalizeHostname,
} from '@/modules/stores/host-resolution';
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

function isAllowedAbsoluteNextTarget(value: string) {
  try {
    const url = new URL(value);
    const hostname = normalizeHostname(url.host);
    const rootDomain = process.env.PLATFORM_ROOT_DOMAIN ?? 'zalenshop.com.br';

    if (!url.pathname.startsWith('/admin')) {
      return false;
    }

    return (
      isLocalhostName(hostname) ||
      hostname === `app.${rootDomain}`
    );
  } catch {
    return false;
  }
}

function getSafeNextTarget(value: string | undefined): string {
  if (!value) {
    return '/admin';
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return isAllowedAbsoluteNextTarget(value) ? value : '/admin';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginClient nextPath={getSafeNextTarget(params?.next)} />;
}
