import type { Metadata } from 'next';
import { noindexMetadata } from '@/modules/seo/seo.service';
import CustomerAuthForm from '../CustomerAuthForm';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse sua conta para acompanhar suas compras.',
  ...noindexMetadata,
};

interface PageProps {
  searchParams?: Promise<{
    next?: string;
  }>;
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/carrinho';
  }

  if (value.startsWith('/admin') || value.startsWith('/platform')) {
    return '/carrinho';
  }

  return value;
}

export default async function CustomerLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <CustomerAuthForm mode="login" nextPath={getSafeNextPath(params?.next)} />;
}
