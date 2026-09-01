import { MessageCircleQuestion } from 'lucide-react';
import { buildProductQuestionWhatsAppUrl } from '@/modules/storefront/whatsapp-contact';

interface ProductWhatsAppQuestionLinkProps {
  productName: string;
  productUrl?: string;
  sku?: string;
  className?: string;
}

export function ProductWhatsAppQuestionLink({
  productName,
  productUrl,
  sku,
  className = '',
}: ProductWhatsAppQuestionLinkProps) {
  const href = buildProductQuestionWhatsAppUrl({ productName, productUrl, sku });

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Tirar uma dúvida sobre ${productName} pelo WhatsApp`}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/55 bg-[#25D366]/10 px-4 text-sm font-semibold text-[#70e89a] transition-colors hover:border-[#25D366] hover:bg-[#25D366]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] ${className}`}
    >
      <MessageCircleQuestion aria-hidden="true" className="h-4 w-4" />
      Dúvidas sobre este produto? Fale no WhatsApp
    </a>
  );
}
