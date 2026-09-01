const BRASIL_DRONES_WHATSAPP_NUMBER = '5545999431780';

export function buildStoreWhatsAppUrl(message: string) {
  return `https://wa.me/${BRASIL_DRONES_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildProductQuestionWhatsAppUrl(input: {
  productName: string;
  productUrl?: string;
  sku?: string;
}) {
  const details = [
    input.productName.trim(),
    input.sku?.trim() ? `SKU: ${input.sku.trim()}` : undefined,
    input.productUrl?.trim() || undefined,
  ].filter(Boolean);

  return buildStoreWhatsAppUrl(
    [
      'Olá! Tenho uma dúvida sobre este produto da Brasil Drones & Parts:',
      '',
      ...details,
      '',
      'Pode me ajudar?',
    ].join('\n')
  );
}
