import { listProducts } from '@/modules/catalog/product.service';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';
import CartClient from './CartClient';

export const metadata = {
  title: 'Carrinho — Brasil Drones & Parts',
};

export default async function CartPage() {
  const products = await listProducts(ACTIVE_STORE_ID);
  return <CartClient products={products} />;
}
