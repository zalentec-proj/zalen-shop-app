import { z } from 'zod';
import { isReservedPlatformSubdomain } from '@/modules/stores/host-resolution';

// Existing PostgreSQL store IDs include seeded UUIDs without RFC version bits.
export const storeIdSchema = z.guid();
export const newStoreSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(2, 'Informe o nome da loja.').max(100),
  slug: z.string().trim().min(3).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens no endereço.')
    .refine((slug) => !isReservedPlatformSubdomain(slug), 'Este endereço é reservado pela plataforma.'),
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email('Informe o e-mail da conta responsável.')),
});

export type PlatformActionState = { ok?: boolean; message?: string; storeId?: string; revision?: number };
export const commandMessages: Record<string, string> = {
  forbidden: 'Você não tem permissão para esta alteração.',
  not_found: 'Loja não encontrada.',
  owner_not_found: 'Não encontramos uma conta com esse e-mail. Crie a conta no Supabase Auth antes de vinculá-la.',
  slug_taken: 'Este endereço já pertence a outra loja.',
  invalid_input: 'Revise os dados informados.',
  conflict: 'A loja foi alterada em outra aba. Recarregue a página antes de salvar.',
  idempotency_conflict: 'Esta solicitação já foi usada com outros dados. Reabra o cadastro.',
  missing_presentation: 'Salve e confira a personalização antes de ativar a loja.',
};
