import type { Metadata } from 'next';
import { listCategories, listProducts } from '@/modules/catalog/product.service';
import { listOrders } from '@/modules/orders/order.service';
import AdminDashboard from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin — Brasil Drones & Parts',
};

export default async function AdminPage() {
  const [products, categories, orders] = await Promise.all([
    listProducts(),
    listCategories(),
    listOrders(),
  ]);

  return <AdminDashboard products={products} categories={categories} orders={orders} />;
}
