import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsertPaymentTransaction: vi.fn(),
  env: {
    MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-test-token',
    MERCADO_PAGO_PUBLIC_KEY: 'APP_USR-test-public-key',
    MERCADO_PAGO_TEST_PAYER_EMAIL: 'checkout-test@zalen.invalid' as string | undefined,
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
  total: 42.5,
  customer: {
    name: 'Cliente Teste',
    email: 'cliente@real.example',
    document: '08590961907',
  },
} as never;

describe('Mercado Pago Payment Brick payload', () => {
  beforeEach(() => {
    mocks.upsertPaymentTransaction.mockReset();
    mocks.env.MERCADO_PAGO_TEST_PAYER_EMAIL = 'checkout-test@zalen.invalid';
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
    expect(body.token).toBeUndefined();
    expect(body.installments).toBeUndefined();
    expect(body.issuer_id).toBeUndefined();
    expect(body.payer.email).toBe('checkout-test@zalen.invalid');
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

  it('does not add a token or card installments to boleto', async () => {
    await createMercadoPagoBrickPayment({
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

  it('rejects a sandbox payment when its safe test payer is absent', async () => {
    mocks.env.MERCADO_PAGO_TEST_PAYER_EMAIL = undefined;

    await expect(
      createMercadoPagoBrickPayment({
        order,
        baseUrl: 'https://loja.example',
        environment: 'test',
        idempotencyKey: 'missing-test-payer',
        formData: {
          payment_method_id: 'pix',
          payment_type_id: 'bank_transfer',
        },
      })
    ).rejects.toMatchObject({
      status: 503,
      reason: 'test_payer_email_not_configured',
    });
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
