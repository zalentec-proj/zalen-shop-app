import type { Metadata } from 'next';
import CustomerAuthForm from '../CustomerAuthForm';

export const metadata: Metadata = {
  title: 'Cadastro — Brasil Drones & Parts',
  description: 'Crie sua conta para comprar na Brasil Drones.',
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
