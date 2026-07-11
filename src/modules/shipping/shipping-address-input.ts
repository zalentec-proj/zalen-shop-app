import { z } from 'zod';

const optionalAddressText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

export const shippingAddressSchema = z.object({
  postalCode: z.string().trim().min(8),
  street: z.string().trim().min(2),
  number: z.string().trim().min(1),
  complement: optionalAddressText,
  district: z.string().trim().min(2),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2).max(2),
});
