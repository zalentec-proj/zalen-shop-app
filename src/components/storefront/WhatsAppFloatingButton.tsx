'use client';

import { usePathname } from 'next/navigation';

const WHATSAPP_URL =
  'https://wa.me/5545999431780?text=Ol%C3%A1%21%20Gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20a%20Brasil%20Drones%20%26%20Parts.';

const HIDDEN_ROUTE_PREFIXES = [
  '/admin',
  '/login',
  '/auth',
  '/integrations',
  '/.well-known',
];

export function WhatsAppFloatingButton() {
  const pathname = usePathname();

  if (HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com a Brasil Drones pelo WhatsApp"
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
