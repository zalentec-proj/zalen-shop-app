import { z } from 'zod';
import { isTemporaryBlingImageUrl } from './catalog-image-url';

const text = (max: number) => z.string().trim().max(max);
const amount = (decimals: number, max: number) => z.string().trim()
  .regex(new RegExp(`^\\d+(?:[.,]\\d{1,${decimals}})?$`), 'Informe um número válido, sem separador de milhar.')
  .transform(value => Number(value.replace(',', '.'))).pipe(z.number().min(0).max(max));
const measure = z.union([z.literal('').transform(() => null), amount(3, 9999)]);

export const manualProductSchema = z.object({
  productId: z.uuid(),
  mode: z.enum(['create', 'edit']),
  name: text(200).min(2, 'Informe o nome do produto.'),
  description: text(10000),
  sku: text(80),
  author: text(200),
  isbn: text(40),
  format: z.enum(['physical', 'ebook']),
  price: amount(2, 9999999),
  stock: z.string().trim().regex(/^\d+$/, 'Informe um estoque inteiro.').transform(Number).pipe(z.number().int().min(0).max(999999)),
  status: z.enum(['draft', 'active', 'inactive']),
  category: text(80),
  imageUrl: text(1024).refine(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !isTemporaryBlingImageUrl(value) && /\.(png|jpe?g|webp|avif)$/i.test(url.pathname);
    } catch { return false; }
  }, 'Use um link HTTPS de imagem PNG, JPG, WebP ou AVIF.'),
  weight: measure, width: measure, height: measure, depth: measure,
}).strict();

export type ManualProduct = z.output<typeof manualProductSchema>;
export type ManualProductFields = z.input<typeof manualProductSchema>;
export function catalogSlug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '');
}
export function emptyManualProduct(productId: string): ManualProductFields {
  return { productId, mode: 'create', name: '', description: '', sku: '', author: '', isbn: '', format: 'physical', price: '', stock: '0', status: 'draft', category: '', imageUrl: '', weight: '', width: '', height: '', depth: '' };
}
