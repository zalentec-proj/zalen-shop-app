import type { Metadata } from 'next';
import CustomerAuthForm from '../CustomerAuthForm';

export const metadata: Metadata = {
  title: 'Entrar — Brasil Drones & Parts',
  description: 'Acesse sua conta para finalizar compras na Brasil Drones.',
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
