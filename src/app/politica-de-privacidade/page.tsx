import type { Metadata } from 'next';
import StoreLegalDocumentPage from '@/components/legal/StoreLegalDocumentPage';

export const metadata: Metadata = { title: 'Política de privacidade', robots: { index: false } };

export default function PrivacyPage() {
  return <StoreLegalDocumentPage documentKey="privacy" fallbackTitle="Política de privacidade" />;
}
