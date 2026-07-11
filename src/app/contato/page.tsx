import type { Metadata } from 'next';
import StoreLegalDocumentPage from '@/components/legal/StoreLegalDocumentPage';

export const metadata: Metadata = { title: 'Contato', robots: { index: false } };

export default function ContactPage() {
  return <StoreLegalDocumentPage documentKey="contact" fallbackTitle="Contato" />;
}
