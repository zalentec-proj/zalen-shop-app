/**
 * Callback OAuth Bling — Route Handler (server-side only).
 * Placeholder seguro — NÃO processa tokens ainda.
 *
 * Quando implementado deve:
 * 1. Validar state anti-CSRF
 * 2. Trocar code por access_token + refresh_token no servidor
 * 3. Criptografar tokens antes de salvar em integration_tokens
 * 4. NUNCA expor tokens no frontend ou em logs
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const _code = searchParams.get('code');
  const _state = searchParams.get('state');

  // TODO: validar state anti-CSRF
  // TODO: trocar code por tokens (server-side)
  // TODO: criptografar e salvar em integration_tokens

  return NextResponse.json(
    { status: 'not_implemented' },
    { status: 501 }
  );
}
