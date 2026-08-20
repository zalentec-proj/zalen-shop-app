import { describe, expect, it } from 'vitest';
import {
  parseGuestCheckoutCookieValue,
  serializeGuestCheckoutCookieValue,
  type GuestCheckoutAccessEntry,
} from './guest-checkout-session';

describe('guest checkout session', () => {
  it('round-trips valid access entries without customer data', () => {
    const now = Date.now();
    const entries: GuestCheckoutAccessEntry[] = [
      {
        storeId: 'store-1',
        orderId: 'order-1',
        attemptKey: 'attempt-1',
        expiresAt: now + 60_000,
      },
    ];

    expect(
      parseGuestCheckoutCookieValue(
        serializeGuestCheckoutCookieValue(entries),
        now
      )
    ).toEqual(entries);
  });

  it('discards malformed and expired access', () => {
    const now = Date.now();
    const encoded = Buffer.from(
      JSON.stringify([
        {
          storeId: 'store-1',
          orderId: 'order-1',
          attemptKey: 'attempt-1',
          expiresAt: now - 1,
        },
        { storeId: 'store-1' },
      ])
    ).toString('base64url');

    expect(parseGuestCheckoutCookieValue(encoded, now)).toEqual([]);
    expect(parseGuestCheckoutCookieValue('not-base64-json', now)).toEqual([]);
  });

  it('keeps only the five most recent entries', () => {
    const now = Date.now();
    const entries = Array.from({ length: 7 }, (_, index) => ({
      storeId: 'store-1',
      orderId: `order-${index}`,
      attemptKey: `attempt-${index}`,
      expiresAt: now + 60_000,
    }));

    const parsed = parseGuestCheckoutCookieValue(
      serializeGuestCheckoutCookieValue(entries),
      now
    );

    expect(parsed.map((entry) => entry.orderId)).toEqual([
      'order-2',
      'order-3',
      'order-4',
      'order-5',
      'order-6',
    ]);
  });
});
