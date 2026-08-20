import 'server-only';

import { cookies } from 'next/headers';

const GUEST_CHECKOUT_COOKIE = 'zalen_guest_checkout_access';
const GUEST_CHECKOUT_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_GUEST_CHECKOUT_ENTRIES = 5;

export type GuestCheckoutAccessEntry = {
  storeId: string;
  orderId: string;
  attemptKey: string;
  expiresAt: number;
};

function isAccessEntry(value: unknown): value is GuestCheckoutAccessEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<GuestCheckoutAccessEntry>;

  return Boolean(
    entry.storeId &&
      entry.orderId &&
      entry.attemptKey &&
      typeof entry.expiresAt === 'number' &&
      Number.isFinite(entry.expiresAt)
  );
}

export function parseGuestCheckoutCookieValue(
  value: string | undefined,
  now = Date.now()
): GuestCheckoutAccessEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isAccessEntry)
      .filter((entry) => entry.expiresAt > now)
      .slice(-MAX_GUEST_CHECKOUT_ENTRIES);
  } catch {
    return [];
  }
}

export function serializeGuestCheckoutCookieValue(
  entries: GuestCheckoutAccessEntry[]
) {
  return Buffer.from(
    JSON.stringify(entries.slice(-MAX_GUEST_CHECKOUT_ENTRIES)),
    'utf8'
  ).toString('base64url');
}

export async function grantGuestCheckoutAccess(input: {
  storeId: string;
  orderId: string;
  attemptKey: string;
}) {
  const cookieStore = await cookies();
  const now = Date.now();
  const currentEntries = parseGuestCheckoutCookieValue(
    cookieStore.get(GUEST_CHECKOUT_COOKIE)?.value,
    now
  );
  const entries = [
    ...currentEntries.filter(
      (entry) =>
        entry.storeId !== input.storeId || entry.orderId !== input.orderId
    ),
    {
      ...input,
      expiresAt: now + GUEST_CHECKOUT_MAX_AGE_SECONDS * 1000,
    },
  ].slice(-MAX_GUEST_CHECKOUT_ENTRIES);

  cookieStore.set(
    GUEST_CHECKOUT_COOKIE,
    serializeGuestCheckoutCookieValue(entries),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GUEST_CHECKOUT_MAX_AGE_SECONDS,
    }
  );
}

export async function getGuestCheckoutAccess(input: {
  storeId: string;
  orderId: string;
}) {
  const cookieStore = await cookies();
  const entries = parseGuestCheckoutCookieValue(
    cookieStore.get(GUEST_CHECKOUT_COOKIE)?.value
  );

  return (
    entries.find(
      (entry) =>
        entry.storeId === input.storeId && entry.orderId === input.orderId
    ) ?? null
  );
}
