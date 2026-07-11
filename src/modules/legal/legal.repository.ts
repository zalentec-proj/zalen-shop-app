import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';

export const legalDocumentKeys = ['privacy', 'terms', 'returns', 'contact'] as const;
export type LegalDocumentKey = (typeof legalDocumentKeys)[number];

export type StoreLegalDocument = {
  id: string;
  storeId: string;
  documentKey: LegalDocumentKey;
  title: string;
  content: string;
  version: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  updatedBy?: string;
  updatedAt: string;
};

type StoreLegalDocumentRow = {
  id: string;
  store_id: string;
  document_key: LegalDocumentKey;
  title: string;
  content: string;
  version: string;
  status: 'draft' | 'published';
  published_at: string | null;
  updated_by: string | null;
  updated_at: string;
};

const fields =
  'id,store_id,document_key,title,content,version,status,published_at,updated_by,updated_at';

function mapDocument(row: StoreLegalDocumentRow): StoreLegalDocument {
  return {
    id: row.id,
    storeId: row.store_id,
    documentKey: row.document_key,
    title: row.title,
    content: row.content,
    version: row.version,
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function getPublishedStoreLegalDocument(input: {
  storeId: string;
  documentKey: LegalDocumentKey;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) return null;

  const { data } = await supabase
    .from('store_legal_documents')
    .select(fields)
    .eq('store_id', input.storeId)
    .eq('document_key', input.documentKey)
    .eq('status', 'published')
    .maybeSingle();

  return data ? mapDocument(data as StoreLegalDocumentRow) : null;
}

export async function listStoreLegalDocuments(storeId: string) {
  const supabase = createOptionalAdminClient();

  if (!supabase) return [] as StoreLegalDocument[];

  const { data } = await supabase
    .from('store_legal_documents')
    .select(fields)
    .eq('store_id', storeId)
    .order('document_key');

  return (data as StoreLegalDocumentRow[] | null ?? []).map(mapDocument);
}

export async function upsertStoreLegalDocument(input: {
  storeId: string;
  documentKey: LegalDocumentKey;
  title: string;
  content: string;
  version: string;
  status: 'draft' | 'published';
  updatedBy: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('legal_document_storage_unavailable');
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('store_legal_documents').upsert(
    {
      store_id: input.storeId,
      document_key: input.documentKey,
      title: input.title,
      content: input.content,
      version: input.version,
      status: input.status,
      published_at: input.status === 'published' ? now : null,
      updated_by: input.updatedBy,
      updated_at: now,
    },
    { onConflict: 'store_id,document_key' }
  );

  if (error) throw new Error('legal_document_save_failed');
}
