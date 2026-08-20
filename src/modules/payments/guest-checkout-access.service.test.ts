import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGuestCheckoutAccess: vi.fn(),
  findCheckoutAttemptForOrderAccess: vi.fn(),
  getOrderByIdFromRepository: vi.fn(),
}));

vi.mock('./guest-checkout-session', () => ({
  getGuestCheckoutAccess: mocks.getGuestCheckoutAccess,
}));

vi.mock('./checkout-attempt.repository', () => ({
  findCheckoutAttemptForOrderAccess: mocks.findCheckoutAttemptForOrderAccess,
}));

vi.mock('@/modules/orders/order.repository', () => ({
  getOrderByIdFromRepository: mocks.getOrderByIdFromRepository,
}));

import { getGuestCheckoutOrderAccess } from './guest-checkout-access.service';

describe('guest checkout order access', () => {
  beforeEach(() => {
    mocks.getGuestCheckoutAccess.mockResolvedValue({
      storeId: 'store-1',
      orderId: 'order-1',
      attemptKey: 'unguessable-attempt-key',
      expiresAt: Date.now() + 60_000,
    });
  });

  it('rejects a cookie capability that does not match a persisted checkout attempt', async () => {
    mocks.findCheckoutAttemptForOrderAccess.mockResolvedValue(null);

    await expect(
      getGuestCheckoutOrderAccess({ storeId: 'store-1', orderId: 'order-1' })
    ).resolves.toBeNull();
    expect(mocks.getOrderByIdFromRepository).not.toHaveBeenCalled();
  });

  it('returns the order only after the store, order and attempt capability match', async () => {
    const attempt = { id: 'attempt-1' };
    const order = { id: 'order-1', storeId: 'store-1' };
    mocks.findCheckoutAttemptForOrderAccess.mockResolvedValue(attempt);
    mocks.getOrderByIdFromRepository.mockResolvedValue(order);

    await expect(
      getGuestCheckoutOrderAccess({ storeId: 'store-1', orderId: 'order-1' })
    ).resolves.toEqual({ attempt, order });
    expect(mocks.findCheckoutAttemptForOrderAccess).toHaveBeenCalledWith({
      storeId: 'store-1',
      orderId: 'order-1',
      attemptKey: 'unguessable-attempt-key',
    });
  });
});
