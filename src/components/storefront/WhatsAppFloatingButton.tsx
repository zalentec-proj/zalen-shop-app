'use client';

import { useStorefrontIdentity } from '@/modules/storefront/StorefrontIdentity';
import { usePathname } from 'next/navigation';
import { buildStoreWhatsAppUrl } from '@/modules/storefront/whatsapp-contact';

const HIDDEN_ROUTE_PREFIXES = [
  '/admin',
  '/platform',
  '/lojas',
  '/login',
  '/auth',
  '/integrations',
  '/.well-known',
];

export function WhatsAppFloatingButton() {
  const pathname = usePathname();
  const identity = useStorefrontIdentity();

  if (!identity?.whatsapp || HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <a
      href={buildStoreWhatsAppUrl(`Olá! Gostaria de tirar uma dúvida sobre ${identity.brandName}.`, identity.whatsapp)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Falar com ${identity.brandName} pelo WhatsApp`}
      className="fixed bottom-5 right-5 z-50 block h-14 w-14 overflow-hidden rounded-full bg-[#25D366] shadow-[0_10px_28px_rgba(37,211,102,0.42)] transition duration-200 hover:-translate-y-1 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366] sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
    >
      <img
        src="/brand/whatsapp-logo.png"
        alt=""
        className="h-full w-full scale-110 object-cover"
      />
    </a>
  );
}
