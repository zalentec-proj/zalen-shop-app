import type { Metadata } from 'next';
import { noindexMetadata } from '@/modules/seo/seo.service';
import CustomerAuthForm from '../CustomerAuthForm';

export const metadata: Metadata = {
  title: 'Cadastro',
  description: 'Crie sua conta para acompanhar suas compras.',
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

export default async function CustomerSignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <CustomerAuthForm mode="signup" nextPath={getSafeNextPath(params?.next)} />;
}
