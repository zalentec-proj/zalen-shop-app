import type { Metadata } from 'next';
import { platformBrand } from '@/lib/branding/platform-brand';
import ForgotPasswordClient from './ForgotPasswordClient';

export const metadata: Metadata = {
  title: `Recuperar senha — ${platformBrand.name}`,
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
