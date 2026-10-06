import 'server-only';
import { checkStoreRole } from '@/modules/auth/auth.service';
import type { RoleCheckResult, StoreRole } from '@/modules/auth/auth.types';

const readRoles: readonly StoreRole[] = ['store_owner', 'store_admin', 'store_operator', 'store_viewer'];

/** Guard at each data entry point, not just in the shared layout. */
export function getAdminReadAccess(storeId: string) {
  return checkStoreRole(storeId, readRoles);
}

export function canWriteAdmin(access: RoleCheckResult) {
  return Boolean(access.allowed && (access.platformRole ||
    (access.membership && access.membership.role !== 'store_viewer')));
}
