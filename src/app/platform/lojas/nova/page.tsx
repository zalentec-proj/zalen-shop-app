import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePlatformAccess } from '@/modules/platform/platform-access';
import { NewStoreForm } from '@/components/platform/StoreManagementForms';

export const metadata = { title: 'Nova loja — Zalen Shop' };
export default async function NewStorePage() {
  const { role } = await requirePlatformAccess();
  if (role !== 'platform_owner') redirect('/platform/lojas');
  return <div className="max-w-2xl">
    <Link href="/platform/lojas" className="text-xs text-blue-300">← Lojas</Link>
    <h1 className="mt-5 text-2xl font-semibold">Nova loja</h1>
    <p className="mb-6 mt-2 text-sm text-slate-400">Cadastre a loja, vincule o responsável e prepare a identidade visual antes de publicar.</p>
    <NewStoreForm requestId={randomUUID()} />
  </div>;
}
