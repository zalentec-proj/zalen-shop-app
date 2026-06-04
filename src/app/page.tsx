import App from '@/App';
import { listStorefrontProducts } from '@/modules/catalog/product.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import { toStorefrontProducts } from '@/modules/catalog/storefront-product.adapter';

export default async function HomePage() {
  const products = toStorefrontProducts(
    await listStorefrontProducts(ACTIVE_STORE_ID)
  );

  return <App products={products} />;
}
