import 'server-only';

import { z } from 'zod';
import { onlyDigits } from '@/modules/customers/br-document';

const viaCepResponseSchema = z
  .object({
    cep: z.string().optional(),
    logradouro: z.string().optional(),
    bairro: z.string().optional(),
    localidade: z.string().optional(),
    uf: z.string().optional(),
    erro: z.boolean().optional(),
  })
  .passthrough();

export type PostalCodeLookupResult =
  | {
      ok: true;
      postalCode: string;
      street?: string;
      district?: string;
      city: string;
      state: string;
    }
  | {
      ok: false;
      errorCode:
        | 'invalid_postal_code'
        | 'postal_code_not_found'
        | 'postal_code_lookup_failed'
        | 'postal_code_incomplete';
    };

function cleanAddressText(value: string | undefined) {
  const text = value?.trim();

  return text ? text : undefined;
}

export async function lookupBrazilianPostalCode(
  postalCode: string
): Promise<PostalCodeLookupResult> {
  const digits = onlyDigits(postalCode);

  if (digits.length !== 8) {
    return {
      ok: false,
      errorCode: 'invalid_postal_code',
    };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 60 * 60 * 24 * 30,
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return {
        ok: false,
        errorCode:
          response.status === 400
            ? 'invalid_postal_code'
            : 'postal_code_lookup_failed',
      };
    }

    const parsed = viaCepResponseSchema.safeParse(await response.json());

    if (!parsed.success || parsed.data.erro) {
      return {
        ok: false,
        errorCode: 'postal_code_not_found',
      };
    }

    const city = cleanAddressText(parsed.data.localidade);
    const state = cleanAddressText(parsed.data.uf)?.toUpperCase();

    if (!city || !state || state.length !== 2) {
      return {
        ok: false,
        errorCode: 'postal_code_incomplete',
      };
    }

    return {
      ok: true,
      postalCode: digits,
      street: cleanAddressText(parsed.data.logradouro),
      district: cleanAddressText(parsed.data.bairro),
      city,
      state,
    };
  } catch {
    return {
      ok: false,
      errorCode: 'postal_code_lookup_failed',
    };
  }
}
