'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createManagedStore, publishManagedStore, saveManagedStore } from '@/modules/platform/store-management.service';
import { presentationSchema } from '@/modules/storefront/presentation';
import type { PlatformActionState } from '@/modules/platform/store-management.schema';

export async function createStoreAction(_previous: PlatformActionState, form: FormData): Promise<PlatformActionState> {
  const result = await createManagedStore(Object.fromEntries(['requestId','name','slug','ownerEmail'].map((key) => [key, form.get(key)])));
  if (!result.ok) return result;
  revalidatePath('/platform/lojas');
  redirect(`/platform/lojas/${result.storeId}?created=1`);
}

export async function saveStoreAction(id: string, _previous: PlatformActionState, form: FormData): Promise<PlatformActionState> {
  try {
    const config = Object.fromEntries(Object.keys(presentationSchema.shape).map((key) => {
      const value = form.get(key);
      return [key, key === 'featuredTopics' && typeof value === 'string'
        ? value.split('\n').map((topic) => topic.trim()).filter(Boolean)
        : value ?? undefined];
    }));
    const result = await saveManagedStore(id, { name: form.get('name'), revision: form.get('revision'), config });
    if (!result.ok) return result;
    revalidatePath(`/platform/lojas/${id}`);
    revalidatePath('/platform/lojas');
    return { ...result, message: 'Rascunho salvo. Confira a prévia antes de publicar.' };
  } catch (error) {
    // Framework auth redirects must propagate instead of becoming a success/error DTO.
    const { unstable_rethrow } = await import('next/navigation');
    unstable_rethrow(error);
    return { ok: false, message: 'Não foi possível salvar. Recarregue a página e tente novamente.' };
  }
}

export async function publishStoreAction(id: string, _previous: PlatformActionState, form: FormData): Promise<PlatformActionState> {
  if (form.get('confirmed') !== 'yes') return { ok: false, message: 'Confirme a alteração do acesso público da loja.' };
  const deactivate = form.get('operation') === 'deactivate';
  const result = await publishManagedStore(id, form.get('revision'), deactivate);
  if (result.ok) {
    revalidatePath('/', 'layout');
    return { ...result, message: deactivate ? 'Loja desativada. O endereço público está indisponível.' : 'Personalização publicada. A loja está ativa.' };
  }
  return result;
}
