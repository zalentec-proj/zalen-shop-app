import type { Metadata } from 'next';
import StoreLegalDocumentPage from '@/components/legal/StoreLegalDocumentPage';

export const metadata: Metadata = { title: 'Trocas e devoluções', robots: { index: false } };

export default function ReturnsPage() {
  return <StoreLegalDocumentPage documentKey="returns" fallbackTitle="Trocas e devoluções" />;
}
