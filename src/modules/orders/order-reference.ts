export type OrderReference =
  | { kind: 'id'; value: string }
  | { kind: 'number'; value: string };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orderNumberPattern = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

export function parseOrderReference(value: string): OrderReference | null {
  const normalized = value.trim();

  if (uuidPattern.test(normalized)) {
    return { kind: 'id', value: normalized.toLowerCase() };
  }

  const orderNumber = normalized.toUpperCase();

  if (orderNumberPattern.test(orderNumber)) {
    return { kind: 'number', value: orderNumber };
  }

  return null;
}
