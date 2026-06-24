import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { runBlingProductSync } from '@/modules/integrations/bling/products/bling-product-sync.service';
import { resolveCurrentStoreFromRequest } from '@/modules/stores/store-resolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSyncRequest(body: unknown): {
  mode: 'full' | 'incremental';
  productId?: string;
} {
  const base = {
    mode: 'incremental' as const,
  };

  if (!body || typeof body !== 'object') {
    return base;
  }

  const record = body as Record<string, unknown>;
  const productId = typeof record.productId === 'string' ? record.productId.trim() : '';

  if (productId && /^\d+$/.test(productId)) {
    return {
      mode: 'full',
      productId,
    };
  }

  if (
    'mode' in record &&
    record.mode === 'full'
  ) {
    return {
      mode: 'full',
    };
  }

  return base;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const store = await resolveCurrentStoreFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { status: 'error', errorCode: 'missing_session' },
      { status: 401 }
    );
  }

  if (!(await canAccessStore(user.id, store.id))) {
    return NextResponse.json(
      { status: 'error', errorCode: 'access_denied' },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  const result = await runBlingProductSync(store.id, getSyncRequest(body));

  if (result.status === 'success') {
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath('/produto/[slug]', 'page');
  }

  return NextResponse.json(result, {
    status: result.status === 'success' ? 200 : 400,
  });
}
