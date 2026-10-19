import 'server-only';
import { createOptionalAdminClient } from '@/lib/supabase/server';
import { requirePlatformAccess } from './platform-access';
import { commandMessages, newStoreSchema, storeIdSchema, type PlatformActionState } from './store-management.schema';
import { defaultPresentation, isRendererAllowed, presentationSchema } from '@/modules/storefront/presentation';
import type { StoreRow } from '@/modules/stores/store.types';

function unavailable(): PlatformActionState { return { ok: false, message: 'Não foi possível salvar. Tente novamente em instantes.' }; }

export async function getManagedStore(id: string) {
  await requirePlatformAccess();
  if (!storeIdSchema.safeParse(id).success) return null;
  const client = createOptionalAdminClient();
  if (!client) throw new Error('platform_store_unavailable');
  const [storeResult, draft, published, profile] = await Promise.all([
    client.from('stores').select('id,name,slug,status,created_at').eq('id', id).maybeSingle(),
    client.from('storefront_drafts').select('config,revision').eq('store_id', id).maybeSingle(),
    client.from('storefront_presentations').select('published_revision,published_at').eq('store_id', id).maybeSingle(),
    client.from('platform_store_profiles').select('responsible_user_id').eq('store_id', id).maybeSingle(),
  ]);
  if ([storeResult, draft, published, profile].some((r) => r.error)) throw new Error('platform_store_unavailable');
  if (!storeResult.data) return null;
  const store = storeResult.data as StoreRow;
  const parsed = presentationSchema.safeParse(draft.data?.config ?? defaultPresentation(store));
  if (!parsed.success || !isRendererAllowed(parsed.data.renderer, store)) throw new Error('platform_presentation_invalid');
  let responsibleUserId = profile.data?.responsible_user_id as string | undefined;
  if (!responsibleUserId) {
    const membership = await client.from('store_memberships').select('user_id').eq('store_id', id).eq('role', 'store_owner').limit(1).maybeSingle();
    if (membership.error) throw new Error('platform_store_unavailable');
    responsibleUserId = membership.data?.user_id;
  }
  const owner = responsibleUserId ? await client.auth.admin.getUserById(responsibleUserId) : null;
  return { store, config: parsed.data, revision: draft.data?.revision ?? 0, publishedRevision: published.data?.published_revision ?? null, publishedAt: published.data?.published_at ?? null, ownerEmail: owner?.data.user?.email ?? null };
}

async function command(actorId: string, action: string, storeId: string | null, payload: object, requestId: string | null = null): Promise<PlatformActionState> {
  const client = createOptionalAdminClient();
  if (!client) return unavailable();
  try {
    const { data, error } = await client.rpc('platform_store_command', {
      p_actor_id: actorId, p_action: action, p_store_id: storeId, p_request_id: requestId, p_payload: payload,
    });
    if (error || !data || typeof data.ok !== 'boolean') return unavailable();
    if (!data.ok) return { ok: false, message: commandMessages[data.code] ?? unavailable().message };
    return { ok: true, storeId: data.storeId, revision: data.revision };
  } catch { return unavailable(); }
}

export async function createManagedStore(input: unknown): Promise<PlatformActionState> {
  const { user, role } = await requirePlatformAccess();
  if (role !== 'platform_owner') return { ok: false, message: commandMessages.forbidden };
  const parsed = newStoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? commandMessages.invalid_input };
  const { requestId, ...data } = parsed.data;
  const config = defaultPresentation({ id: '', name: data.name, slug: data.slug });
  return command(user.id, 'create', null, { ...data, config }, requestId);
}

export async function saveManagedStore(id: string, input: { name: unknown; revision: unknown; config: unknown }): Promise<PlatformActionState> {
  const { user } = await requirePlatformAccess();
  if (!storeIdSchema.safeParse(id).success) return { ok: false, message: commandMessages.invalid_input };
  const store = await getManagedStore(id);
  if (!store) return { ok: false, message: commandMessages.not_found };
  const parsed = presentationSchema.safeParse(input.config);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const revision = Number(input.revision);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? commandMessages.invalid_input };
  if (name.length < 2 || name.length > 100 || !Number.isSafeInteger(revision) || revision < 0 || !isRendererAllowed(parsed.data.renderer, store.store)) return { ok: false, message: commandMessages.invalid_input };
  return command(user.id, 'save', id, { name, revision, config: parsed.data });
}

export async function publishManagedStore(id: string, revision: unknown, deactivate = false): Promise<PlatformActionState> {
  const { user, role } = await requirePlatformAccess();
  if (role !== 'platform_owner') return { ok: false, message: commandMessages.forbidden };
  const version = Number(revision);
  if (!storeIdSchema.safeParse(id).success || !Number.isSafeInteger(version) || version < 0) return { ok: false, message: commandMessages.invalid_input };
  return command(user.id, deactivate ? 'deactivate' : 'publish', id, { revision: version });
}
