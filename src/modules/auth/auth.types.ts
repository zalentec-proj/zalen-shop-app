export type AdminRole = 'owner' | 'admin' | 'operator' | 'viewer';

export interface AuthUser {
  id: string;
  email?: string;
}

export interface StoreMembership {
  id: string;
  userId: string;
  storeId: string;
  role: AdminRole;
  createdAt: string;
}

export interface RoleCheckResult {
  user: AuthUser | null;
  membership: StoreMembership | null;
  allowed: boolean;
}
