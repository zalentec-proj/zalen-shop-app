export type StoreStatus = 'active' | 'inactive' | 'planned' | string;

export interface StoreContext {
  id: string;
  mockId?: string;
  name: string;
  shortName: string;
  slug: string;
  status: StoreStatus;
  storefrontPath: string;
  source: 'static' | 'supabase';
}

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at?: string | null;
}
