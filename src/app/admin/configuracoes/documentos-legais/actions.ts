'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { StoreRole } from '@/modules/auth/auth.types';
import {
  legalDocumentKeys,
  upsertStoreLegalDocument,
} from '@/modules/legal/legal.repository';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { adminActionError, adminActionSuccess, type AdminActionResult } from '@/modules/admin/admin-action-result';

const writableRoles: StoreRole[] = ['store_owner', 'store_admin', 'store_operator'];

const schema = z.object({
  documentKey: z.enum(legalDocumentKeys),
  title: z.string().trim().min(3).max(120),
  content: z.string().trim().min(20).max(30000),
  version: z.string().trim().min(1).max(40),
  status: z.enum(['draft', 'published']),
});

export async function saveStoreLegalDocumentAction(formData: FormData): Promise<AdminActionResult> {
  const parsed = schema.safeParse({
    documentKey: formData.get('documentKey'),
    title: formData.get('title'),
    content: formData.get('content'),
    version: formData.get('version'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return adminActionError('Revise título, versão e conteúdo antes de salvar.');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, writableRoles);

  if (!access.allowed || !access.user) {
    return adminActionError('Você não possui permissão para editar documentos legais.');
  }

  await upsertStoreLegalDocument({
    storeId: store.id,
    updatedBy: access.user.id,
    ...parsed.data,
  });

  const paths = {
    privacy: '/politica-de-privacidade',
    terms: '/termos-de-uso',
    returns: '/trocas-e-devolucoes',
    contact: '/contato',
  } as const;
  revalidatePath(paths[parsed.data.documentKey]);
  revalidatePath('/admin/configuracoes/documentos-legais');
  return adminActionSuccess('Documento legal salvo com sucesso.');
}
