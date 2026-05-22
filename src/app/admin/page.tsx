import type { Metadata } from 'next';
import { listCategories, listProducts } from '@/modules/catalog/product.service';
import AdminDashboard from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin — Brasil Drones & Parts',
};

export default async function AdminPage() {
  const [products, categories] = await Promise.all([
    listProducts(),
    listCategories(),
  ]);

  return <AdminDashboard products={products} categories={categories} />;
}
