import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateLink: vi.fn(),
  renderEmail: vi.fn(),
  sendEmail: vi.fn(),
  rateLimit: vi.fn(),
  findCustomer: vi.fn(),
  enqueueWhatsApp: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink: mocks.generateLink } } }),
  createClient: vi.fn(),
}));

vi.mock('@/modules/email/email.templates', () => ({
  renderCustomerLoginCodeEmail: mocks.renderEmail,
}));

vi.mock('@/modules/email/email.service', () => ({
  sendStoreEmail: mocks.sendEmail,
}));

vi.mock('@/modules/security/rate-limit.service', () => ({
  enforceRateLimit: mocks.rateLimit,
}));

vi.mock('@/modules/customers/customer.service', () => ({
  findCustomerByEmail: mocks.findCustomer,
}));

vi.mock('@/modules/integrations/evolution-whatsapp/evolution-whatsapp.service', () => ({
  enqueueLoginCodeViaWhatsApp: mocks.enqueueWhatsApp,
}));

vi.mock('./customer-account.service', () => ({
  linkOrCreateCustomerAccount: vi.fn(),
}));

import { requestCustomerLoginCode } from './customer-auth.service';

describe('customer login code delivery', () => {
  beforeEach(() => {
    mocks.generateLink.mockResolvedValue({
      data: { properties: { email_otp: '654321' } },
      error: null,
    });
    mocks.renderEmail.mockReturnValue({
      subject: 'Código',
      html: '<p>654321</p>',
      text: '654321',
    });
    mocks.sendEmail.mockResolvedValue({ ok: true, status: 'sent' });
    mocks.findCustomer.mockResolvedValue({ id: 'customer-1' });
    mocks.enqueueWhatsApp.mockResolvedValue({
      delivery: { id: 'delivery-1' },
      status: 'accepted',
    });
  });

  it('sends exactly the Supabase e-mail OTP through both confirmed channels', async () => {
    const result = await requestCustomerLoginCode({
      storeId: 'store-1',
      storeName: 'Brasil Drones',
      email: 'CLIENTE@EXEMPLO.COM ',
      baseUrl: 'https://loja.exemplo.com',
      next: '/carrinho',
    });

    expect(mocks.renderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ code: '654321' })
    );
    expect(mocks.enqueueWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-1',
        code: '654321',
      })
    );
    const whatsappInput = mocks.enqueueWhatsApp.mock.calls[0][0] as {
      idempotencyKey: string;
    };
    expect(whatsappInput.idempotencyKey).not.toContain('654321');
    expect(result).toMatchObject({
      email: 'cliente@exemplo.com',
      emailSent: true,
      whatsappStatus: 'accepted',
    });
  });

  it('keeps e-mail as the only channel for a customer without a verified account record', async () => {
    mocks.findCustomer.mockResolvedValueOnce(null);

    const result = await requestCustomerLoginCode({
      storeId: 'store-1',
      storeName: 'Brasil Drones',
      email: 'cliente@exemplo.com',
      baseUrl: 'https://loja.exemplo.com',
    });

    expect(mocks.enqueueWhatsApp).not.toHaveBeenCalled();
    expect(result.whatsappStatus).toBe('not_eligible');
    expect(result.emailSent).toBe(true);
  });
});
