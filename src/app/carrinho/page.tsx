import { listProducts } from '@/modules/catalog/product.service';
import CartClient from './CartClient';

export const metadata = {
  title: 'Carrinho — Brasil Drones & Parts',
};

export default async function CartPage() {
  const products = await listProducts();
  return <CartClient products={products} />;
}
