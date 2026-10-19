const BRASIL_DRONES_WHATSAPP_NUMBER = '5545999431780';

export function buildStoreWhatsAppUrl(message: string, number = BRASIL_DRONES_WHATSAPP_NUMBER) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildProductQuestionWhatsAppUrl(input: {
  productName: string;
  productUrl?: string;
  sku?: string;
  whatsapp?: string;
  brandName?: string;
}) {
  const details = [
    input.productName.trim(),
    input.sku?.trim() ? `SKU: ${input.sku.trim()}` : undefined,
    input.productUrl?.trim() || undefined,
  ].filter(Boolean);

  return buildStoreWhatsAppUrl(
    [
      `Olá! Tenho uma dúvida sobre este produto ${input.brandName ? `de ${input.brandName}` : 'da Brasil Drones & Parts'}:`,
      '',
      ...details,
      '',
      'Pode me ajudar?',
    ].join('\n'), input.whatsapp
  );
}
