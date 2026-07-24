import 'server-only';

import { revalidatePath } from 'next/cache';

export function revalidateBlingCatalogPaths() {
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/integracoes/bling');
  revalidatePath('/categoria/[slug]', 'page');
  revalidatePath('/produto/[slug]', 'page');
}
