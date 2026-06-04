import App from '@/App';
import { listStorefrontProducts } from '@/modules/catalog/product.service';
import { toStorefrontProducts } from '@/modules/catalog/storefront-product.adapter';

export default async function HomePage() {
  const products = toStorefrontProducts(await listStorefrontProducts());

  return <App products={products} />;
}
