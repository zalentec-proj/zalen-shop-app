import { describe, expect, it } from 'vitest';
import {
  buildMercadoPagoBrickPaymentPayload,
  MercadoPagoPaymentPayloadError,
} from './mercado-pago-payment-payload';

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  storeId: '00000000-0000-0000-0000-000000000001',
  orderNumber: 'BD-TESTE',
  total: 42.5,
  customer: {
    name: 'Cliente Teste',
    document: '085.909.619-07',
  },
};

describe('Mercado Pago payment payload contract', () => {
  it('creates a complete card-only payload with the immutable order total', () => {
    const result = buildMercadoPagoBrickPaymentPayload({
      order,
      payerEmail: 'buyer@example.test',
      notificationUrl: 'https://loja.example/webhook',
      environment: 'test',
      formData: {
        payment_method_id: 'master',
        payment_type_id: 'credit_card',
        token: 'safe-card-token',
        installments: '3',
        issuer_id: 123,
        transaction_amount: 1,
        payer: {
          first_name: 'APRO',
          identification: { type: 'CPF', number: '123.456.789-09' },
        },
      },
    });

    expect(result.paymentKind).toBe('card');
    expect(result.body).toMatchObject({
      transaction_amount: 42.5,
      payment_method_id: 'master',
      token: 'safe-card-token',
      installments: 3,
      issuer_id: 123,
      external_reference: order.id,
      payer: {
        email: 'buyer@example.test',
        first_name: 'APRO',
        identification: { type: 'CPF', number: '12345678909' },
      },
    });
  });

  it('creates Pix without token, issuer or installments', () => {
    const result = buildMercadoPagoBrickPaymentPayload({
      order,
      payerEmail: 'buyer@example.test',
      environment: 'test',
      formData: {
        payment_method_id: 'pix',
        payment_type_id: 'bank_transfer',
        token: 'must-not-be-sent',
        installments: 12,
        issuer_id: '123',
      },
    });

    expect(result.paymentKind).toBe('pix');
    expect(result.body).not.toHaveProperty('token');
    expect(result.body).not.toHaveProperty('issuer_id');
    expect(result.body).not.toHaveProperty('installments');
  });

  it('creates boleto without card information', () => {
    const result = buildMercadoPagoBrickPaymentPayload({
      order,
      payerEmail: 'buyer@example.test',
      environment: 'production',
      formData: {
        payment_method_id: 'bolbradesco',
        payment_type_id: 'ticket',
      },
    });

    expect(result.paymentKind).toBe('ticket');
    expect(result.body).toMatchObject({
      payment_method_id: 'bolbradesco',
      payer: { identification: { type: 'CPF', number: '08590961907' } },
    });
    expect(result.body).not.toHaveProperty('token');
  });

  it('rejects unsupported methods and card submissions without a token', () => {
    const unsupportedMethod = () =>
      buildMercadoPagoBrickPaymentPayload({
        order,
        payerEmail: 'buyer@example.test',
        environment: 'test',
        formData: { payment_method_id: 'unknown' },
      });

    expect(unsupportedMethod).toThrow(MercadoPagoPaymentPayloadError);
    try {
      unsupportedMethod();
    } catch (error) {
      expect(error).toMatchObject({ code: 'unsupported_payment_method' });
    }

    const missingCardToken = () =>
      buildMercadoPagoBrickPaymentPayload({
        order,
        payerEmail: 'buyer@example.test',
        environment: 'test',
        formData: {
          payment_method_id: 'visa',
          payment_type_id: 'credit_card',
        },
      });

    expect(missingCardToken).toThrow(MercadoPagoPaymentPayloadError);
    try {
      missingCardToken();
    } catch (error) {
      expect(error).toMatchObject({ code: 'card_token_missing' });
    }
  });
});
