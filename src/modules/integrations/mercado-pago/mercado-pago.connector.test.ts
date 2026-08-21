import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsertPaymentTransaction: vi.fn(),
  env: {
    MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-test-token',
    MERCADO_PAGO_PUBLIC_KEY: 'APP_USR-test-public-key',
  },
  defaultEnvironment: 'test' as 'test' | 'production',
}));

vi.mock('@/lib/env/server', () => ({
  getServerEnv: () => mocks.env,
}));

vi.mock('@/modules/payments/payment-transaction.repository', () => ({
  upsertPaymentTransaction: mocks.upsertPaymentTransaction,
}));

vi.mock('@/modules/integrations/core/credential-vault', () => ({
  decryptIntegrationCredentials: vi.fn(),
  encryptIntegrationCredentials: vi.fn(),
}));

vi.mock('./mercado-pago.config', () => ({
  getDefaultMercadoPagoEnvironment: () => mocks.defaultEnvironment,
  getMercadoPagoOAuthConfig: () => ({ isConfigured: true }),
  getMercadoPagoWebhookSecret: () => 'test-secret',
}));

vi.mock('./mercado-pago.oauth', () => ({
  refreshMercadoPagoAccessToken: vi.fn(),
}));

vi.mock('./mercado-pago.repository', () => ({
  getMercadoPagoIntegrationFromRepository: vi.fn().mockResolvedValue(null),
  getMercadoPagoStorePreferenceFromRepository: vi.fn().mockResolvedValue({ activeEnvironment: 'test' }),
  saveMercadoPagoRefreshedCredentialsInRepository: vi.fn(),
}));

import { createMercadoPagoBrickPayment } from './mercado-pago.connector';

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  storeId: '00000000-0000-0000-0000-000000000001',
  orderNumber: 'BD-TESTE',
  subtotal: 30,
  shippingTotal: 12.5,
  discountTotal: 0,
  total: 42.5,
  items: [
    {
      productId: 'product-1',
      variantId: 'variant-1',
      sku: 'SKU-1',
      name: 'Produto de teste',
      quantity: 1,
      unitPrice: 30,
    },
  ],
  customer: {
    name: 'Cliente Teste',
    email: 'cliente@real.example',
    document: '08590961907',
    shippingAddress: {
      postalCode: '85801-210',
      street: 'Rua Pio XII',
      number: '123',
      district: 'Centro',
      city: 'Cascavel',
      state: 'PR',
    },
  },
} as never;

describe('Mercado Pago Payment Brick payload', () => {
  beforeEach(() => {
    mocks.upsertPaymentTransaction.mockReset();
    mocks.defaultEnvironment = 'test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'mp-payment-1',
            status: 'pending',
            payment_method_id: 'pix',
            payment_type_id: 'bank_transfer',
            transaction_amount: 42.5,
            point_of_interaction: {
              transaction_data: { qr_code: 'pix-code', ticket_url: 'https://mp.test/pix' },
            },
          }),
          { status: 201 }
        )
      )
    );
  });

  it('does not send card fields when the customer selects Pix', async () => {
    await createMercadoPagoBrickPayment({
      order,
      baseUrl: 'https://loja.example',
      environment: 'test',
      idempotencyKey: 'pix-attempt',
      formData: {
        payment_method_id: 'pix',
        payment_type_id: 'bank_transfer',
        token: 'card-token-that-must-not-leak',
        installments: 12,
        issuer_id: '123',
      },
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.payment_method_id).toBe('pix');
    expect(body.transaction_amount).toBe(42.5);
    expect(body.notification_url).toBe(
      'https://loja.example/api/webhooks/mercado-pago/00000000-0000-0000-0000-000000000001/test'
    );
    expect(body.token).toBeUndefined();
    expect(body.installments).toBeUndefined();
    expect(body.issuer_id).toBeUndefined();
    expect(body.payer.email).toBe('cliente@real.example');
  });

  it('sends a token and installments only for cards', async () => {
    await createMercadoPagoBrickPayment({
      order,
      baseUrl: 'https://loja.example',
      environment: 'test',
      idempotencyKey: 'card-attempt',
      formData: {
        payment_method_id: 'master',
        payment_type_id: 'credit_card',
        token: 'card-token',
        installments: 2,
        issuer_id: '123',
      },
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.token).toBe('card-token');
    expect(body.installments).toBe(2);
    expect(body.issuer_id).toBe('123');
  });

  it('persists boleto instructions without card fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'mp-ticket-1',
            status: 'pending',
            status_detail: 'pending_waiting_payment',
            payment_method_id: 'bolbradesco',
            payment_type_id: 'ticket',
            transaction_amount: 42.5,
            barcode: [{ content: '23793380296060054351030006333303799140000020000' }],
            transaction_details: {
              external_resource_url: 'https://mp.test/ticket',
              payment_method_reference_id: '6004835002',
              verification_code: '1234567890',
            },
            date_of_expiration: '2026-07-14T23:59:59.000Z',
          }),
          { status: 201 }
        )
      )
    );

    const result = await createMercadoPagoBrickPayment({
      order,
      baseUrl: 'https://loja.example',
      environment: 'test',
      idempotencyKey: 'ticket-attempt',
      formData: {
        payment_method_id: 'bolbradesco',
        payment_type_id: 'ticket',
        token: 'card-token-that-must-not-leak',
        installments: 6,
      },
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.payment_method_id).toBe('bolbradesco');
    expect(body.token).toBeUndefined();
    expect(body.installments).toBeUndefined();
    expect(body.payer.address).toEqual({
      zip_code: '85801210',
      street_name: 'Rua Pio XII',
      street_number: '123',
      neighborhood: 'Centro',
      city: 'Cascavel',
      federal_unit: 'PR',
    });
    expect(result.paymentInstructions).toEqual({
      ticket: {
        barcodeContent: '23793380296060054351030006333303799140000020000',
        reference: '6004835002',
        verificationCode: '1234567890',
      },
      externalResourceUrl: 'https://mp.test/ticket',
      expiresAt: '2026-07-14T23:59:59.000Z',
    });
  });

  it('uses the real buyer email only in production', async () => {
    mocks.defaultEnvironment = 'production';
    await createMercadoPagoBrickPayment({
      order,
      baseUrl: 'https://loja.example',
      environment: 'production',
      idempotencyKey: 'production-card-attempt',
      formData: {
        payment_method_id: 'master',
        payment_type_id: 'credit_card',
        token: 'card-token',
        installments: 1,
      },
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.payer.email).toBe('cliente@real.example');
  });

  it('uses the checkout customer email in sandbox without a test-user override', async () => {
    await createMercadoPagoBrickPayment({
      order,
      baseUrl: 'https://loja.example',
      environment: 'test',
      idempotencyKey: 'sandbox-customer-email',
      formData: {
        payment_method_id: 'pix',
        payment_type_id: 'bank_transfer',
      },
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.payer.email).toBe('cliente@real.example');
  });

  it('keeps provider errors on the server boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'invalid request' }), { status: 400 })
      )
    );

    await expect(
      createMercadoPagoBrickPayment({
        order,
        baseUrl: 'https://loja.example',
        environment: 'test',
        idempotencyKey: 'invalid-payment',
        formData: {
          payment_method_id: 'pix',
          payment_type_id: 'bank_transfer',
        },
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});
