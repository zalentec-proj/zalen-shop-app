/**
 * Webhook Bling — Route Handler (server-side only).
 * Placeholder seguro — NÃO processa nada ainda.
 *
 * Quando implementado deve:
 * 1. Validar assinatura HMAC do Bling
 * 2. Salvar payload bruto em webhook_events
 * 3. Responder 200 imediatamente
 * 4. Processar em background (queue/job)
 * 5. Garantir idempotência via external_id
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // TODO: validar assinatura Bling antes de qualquer processamento
  // TODO: salvar payload em webhook_events com status 'received'
  // TODO: enfileirar processamento assíncrono

  const _body = await request.text(); // consumir body sem processar

  return NextResponse.json(
    { received: true, status: 'not_implemented' },
    { status: 200 }
  );
}
