/**
 * Estrutura inicial de Auth do admin.
 * Ainda não bloqueia /admin; prepara helpers para a próxima sprint.
 */

import 'server-only';

import {
  createOptionalAdminClient,
  createOptionalClient,
} from '@/lib/supabase/server';
import type {
  AdminRole,
  AuthUser,
  PlatformRole,
  RoleCheckResult,
  StoreMembership,
  StoreRole,
} from './auth.types';

const platformRoles: PlatformRole[] = ['platform_owner', 'platform_admin'];
const storeRoles: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_operator',
  'store_viewer',
];
const legacyStoreRoleMap: Record<string, StoreRole> = {
  owner: 'store_owner',
  admin: 'store_admin',
  operator: 'store_operator',
  viewer: 'store_viewer',
};

type MembershipRow = {
  id: string;
  store_id: string;
  user_id: string;
  role: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

function toPlatformRole(role: string | null | undefined): PlatformRole | null {
  return platformRoles.includes(role as PlatformRole)
    ? (role as PlatformRole)
    : null;
}

function toStoreRole(role: string | null | undefined): StoreRole | null {
  if (!role) {
    return null;
  }

  if (storeRoles.includes(role as StoreRole)) {
    return role as StoreRole;
  }

  return legacyStoreRoleMap[role] ?? null;
}

function mapStoreMembership(row: MembershipRow): StoreMembership | null {
  const role = toStoreRole(row.role);

  if (!role) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    role,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
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

export async function getPlatformRole(
  userId: string
): Promise<PlatformRole | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('platform_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toPlatformRole(data.role);
}

export async function getStoreMembership(
  userId: string,
  storeId: string
): Promise<StoreMembership | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('store_memberships')
    .select('id, user_id, store_id, role, created_at, updated_at')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    return mapStoreMembership(data);
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('memberships')
    .select('id, user_id, store_id, role, created_at')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (legacyError || !legacyData) {
    return null;
  }

  return mapStoreMembership(legacyData);
}

export async function canAccessStore(
  userId: string,
  storeId: string
): Promise<boolean> {
  const platformRole = await getPlatformRole(userId);

  if (platformRole) {
    return true;
  }

  return Boolean(await getStoreMembership(userId, storeId));
}

export async function getCurrentMembership(
  storeId: string
): Promise<StoreMembership | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return getStoreMembership(user.id, storeId);
}

export async function checkStoreRole(
  storeId: string,
  roles: AdminRole[]
): Promise<RoleCheckResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      platformRole: null,
      membership: null,
      allowed: false,
    };
  }

  const platformRole = await getPlatformRole(user.id);
  const membership = await getStoreMembership(user.id, storeId);

  return {
    user,
    platformRole,
    membership,
    allowed: Boolean(platformRole || (membership && roles.includes(membership.role))),
  };
}

export async function hasStoreRole(
  storeId: string,
  roles: AdminRole[]
): Promise<boolean> {
  const result = await checkStoreRole(storeId, roles);
  return result.allowed;
}
