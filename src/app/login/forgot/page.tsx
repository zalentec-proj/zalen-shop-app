import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import { noindexMetadata } from '@/modules/seo/seo.service';
import ForgotPasswordClient from './ForgotPasswordClient';

export const metadata: Metadata = {
  title: `Recuperar senha — ${platformBrand.name}`,
  ...noindexMetadata,
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
