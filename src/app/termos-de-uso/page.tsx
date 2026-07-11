import type { Metadata } from 'next';
import StoreLegalDocumentPage from '@/components/legal/StoreLegalDocumentPage';

export const metadata: Metadata = { title: 'Termos de uso', robots: { index: false } };

export default function TermsPage() {
  return <StoreLegalDocumentPage documentKey="terms" fallbackTitle="Termos de uso" />;
}
