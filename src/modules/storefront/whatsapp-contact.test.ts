import { describe, expect, it } from 'vitest';
import {
  buildProductQuestionWhatsAppUrl,
  buildStoreWhatsAppUrl,
} from './whatsapp-contact';

describe('storefront WhatsApp contact links', () => {
  it('encodes a product-specific question with its SKU and URL', () => {
    const url = new URL(
      buildProductQuestionWhatsAppUrl({
        productName: 'Bateria DJI Mini 4 Pro',
        sku: 'BAT-42',
        productUrl: 'https://www.brasildroneseparts.com.br/produto/bateria-mini-4-pro',
      })
    );

    expect(url.hostname).toBe('wa.me');
    expect(url.pathname).toBe('/5545999431780');
    expect(url.searchParams.get('text')).toBe(
      [
        'Olá! Tenho uma dúvida sobre este produto da Brasil Drones & Parts:',
        '',
        'Bateria DJI Mini 4 Pro',
        'SKU: BAT-42',
        'https://www.brasildroneseparts.com.br/produto/bateria-mini-4-pro',
        '',
        'Pode me ajudar?',
      ].join('\n')
    );
  });

  it('builds the generic store contact with the same destination', () => {
    expect(buildStoreWhatsAppUrl('Olá')).toBe(
      'https://wa.me/5545999431780?text=Ol%C3%A1'
    );
  });
});
