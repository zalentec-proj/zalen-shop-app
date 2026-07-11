import { z } from 'zod';

// Shipping providers calculate rates from the destination postal code. The full
// delivery address is validated separately before the order is created.
export const shippingQuoteAddressSchema = z.object({
  postalCode: z.string().trim().min(8),
});
