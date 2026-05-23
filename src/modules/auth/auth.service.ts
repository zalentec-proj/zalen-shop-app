/**
 * Estrutura inicial de Auth do admin.
 * Ainda não bloqueia /admin; prepara helpers para a próxima sprint.
 */

import 'server-only';

import { createOptionalClient } from '@/lib/supabase/server';
import type { AdminRole, AuthUser, RoleCheckResult, StoreMembership } from './auth.types';

const allowedRoles: AdminRole[] = ['owner', 'admin', 'operator', 'viewer'];

function toAdminRole(role: string | null | undefined): AdminRole | null {
  return allowedRoles.includes(role as AdminRole) ? (role as AdminRole) : null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createOptionalClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

export async function getCurrentMembership(
  storeId: string
): Promise<StoreMembership | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createOptionalClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, store_id, role, created_at')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const role = toAdminRole(data.role);

  if (!role) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    storeId: data.store_id,
    role,
    createdAt: data.created_at,
  };
}

export async function checkStoreRole(
  storeId: string,
  roles: AdminRole[]
): Promise<RoleCheckResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { user: null, membership: null, allowed: false };
  }

  const membership = await getCurrentMembership(storeId);

  return {
    user,
    membership,
    allowed: Boolean(membership && roles.includes(membership.role)),
  };
}

export async function hasStoreRole(
  storeId: string,
  roles: AdminRole[]
): Promise<boolean> {
  const result = await checkStoreRole(storeId, roles);
  return result.allowed;
}
