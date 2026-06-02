export type PlatformRole = 'platform_owner' | 'platform_admin';

export type StoreRole =
  | 'store_owner'
  | 'store_admin'
  | 'store_operator'
  | 'store_viewer';

export type AdminRole = StoreRole;

export interface AuthUser {
  id: string;
  email?: string;
}

export interface PlatformUser {
  id: string;
  userId: string;
  role: PlatformRole;
  createdAt: string;
  updatedAt: string;
}

export interface StoreMembership {
  id: string;
  userId: string;
  storeId: string;
  role: StoreRole;
  createdAt: string;
  updatedAt: string;
}

export interface RoleCheckResult {
  user: AuthUser | null;
  platformRole: PlatformRole | null;
  membership: StoreMembership | null;
  allowed: boolean;
}
