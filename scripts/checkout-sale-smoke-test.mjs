#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const STORE_ID = '00000000-0000-0000-0000-000000000001';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getSupabaseKey() {
  return (
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    requiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
    requiredEnv('SUPABASE_SECRET_KEY')
  );
}

function hasEnv(name) {
  return Boolean(requiredEnv(name));
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeMethods(methods) {
  return methods.map((method) => ({
    kind: method.kind,
    provider: method.provider_key ?? 'native',
    service: method.service_code,
    name: method.name,
    status: method.status,
    price: toNumber(method.price),
    freeOverSubtotal:
      method.free_over_subtotal === null
        ? undefined
        : toNumber(method.free_over_subtotal),
  }));
}

async function queryOrThrow(supabase, table, select, apply = (query) => query) {
  const { data, error } = await apply(supabase.from(table).select(select));

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

async function createMercadoPagoPreferenceProbe() {
  const accessToken = requiredEnv('MERCADO_PAGO_ACCESS_TOKEN');

  if (!accessToken) {
    return {
      ok: false,
      reason: 'MERCADO_PAGO_ACCESS_TOKEN ausente',
    };
  }

  const body = {
    external_reference: `zalen-smoke-${Date.now()}`,
    back_urls: {
      success:
        'http://localhost:3001/pagamento/mercado-pago/sucesso?smoke=1',
      pending:
        'http://localhost:3001/pagamento/mercado-pago/pendente?smoke=1',
      failure:
        'http://localhost:3001/pagamento/mercado-pago/falha?smoke=1',
    },
    metadata: {
      source: 'checkout-sale-smoke-test',
      store_id: STORE_ID,
    },
    payer: {
      name: 'Cliente',
      surname: 'Teste',
      email: 'comprador.teste.zalen@example.com',
      identification: {
        type: 'CPF',
        number: '08590961908',
      },
    },
    items: [
      {
        id: 'zalen-smoke-item',
        title: 'Produto teste Zalen',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: 10,
      },
    ],
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reason:
        payload?.message ??
        payload?.error ??
        payload?.cause?.[0]?.description ??
        'mercado_pago_preference_failed',
    };
  }

  return {
    ok: true,
    status: response.status,
    preferenceId: payload.id,
    hasInitPoint: Boolean(payload.init_point),
    hasSandboxInitPoint: Boolean(payload.sandbox_init_point),
  };
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getSupabaseKey();
  const blockers = [];
  const warnings = [];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL/key ausentes no ambiente local.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const [stores, products, variants, shippingMethods, origins, priceLists] =
    await Promise.all([
      queryOrThrow(supabase, 'stores', 'id,name,slug,status', (query) =>
        query.eq('id', STORE_ID)
      ),
      queryOrThrow(supabase, 'products', 'id,name,status,requires_shipping', (query) =>
        query.eq('store_id', STORE_ID)
      ),
      queryOrThrow(
        supabase,
        'product_variants',
        'id,product_id,sku,price,stock,weight,width,height,depth',
        (query) => query.eq('store_id', STORE_ID)
      ),
      queryOrThrow(
        supabase,
        'shipping_methods',
        'kind,provider_key,service_code,name,status,price,free_over_subtotal',
        (query) => query.eq('store_id', STORE_ID)
      ),
      queryOrThrow(
        supabase,
        'store_shipping_origins',
        'id,status,postal_code,city,state',
        (query) => query.eq('store_id', STORE_ID)
      ),
      queryOrThrow(
        supabase,
        'price_lists',
        'id,name,customer_type,status',
        (query) => query.eq('store_id', STORE_ID)
      ),
    ]);

  const activeStore = stores[0];
  const activeProducts = products.filter((product) => product.status === 'active');
  const activeShippingMethods = shippingMethods.filter(
    (method) => method.status === 'active'
  );
  const hasSuperFreteActive = activeShippingMethods.some(
    (method) =>
      method.kind === 'external' && method.provider_key === 'superfrete'
  );
  const hasNativeActive = activeShippingMethods.some(
    (method) => method.kind !== 'external'
  );
  const activeOrigin = origins.find((origin) => origin.status === 'active');
  const missingDimensions = variants.filter(
    (variant) =>
      !toNumber(variant.weight) ||
      !toNumber(variant.width) ||
      !toNumber(variant.height) ||
      !toNumber(variant.depth)
  );

  if (!activeStore || activeStore.status !== 'active') {
    blockers.push('Loja Brasil Drones não está ativa.');
  }

  if (activeProducts.length === 0 || variants.length === 0) {
    blockers.push('Catálogo sem produto/variante ativa para vender.');
  }

  if (activeShippingMethods.length === 0) {
    blockers.push('Nenhum método de frete ativo.');
  }

  if (hasSuperFreteActive && !activeOrigin) {
    blockers.push('SuperFrete ativo, mas sem origem de envio ativa.');
  }

  if (
    hasSuperFreteActive &&
    !hasEnv('SUPERFRETE_API_TOKEN_BRASIL_DRONES') &&
    !hasEnv('SUPER_FRETE_API') &&
    process.env.ENABLE_MANUAL_SHIPPING_FALLBACK !== 'true'
  ) {
    blockers.push(
      'SuperFrete ativo sem token e sem ENABLE_MANUAL_SHIPPING_FALLBACK=true.'
    );
  }

  if (hasSuperFreteActive && missingDimensions.length > 0) {
    warnings.push(
      `${missingDimensions.length} variante(s) sem peso/dimensões completas para cotação SuperFrete.`
    );
  }

  if (!hasNativeActive && process.env.ENABLE_MANUAL_SHIPPING_FALLBACK === 'true') {
    blockers.push('Fallback manual habilitado, mas sem método de frete nativo ativo.');
  }

  if (!hasEnv('MERCADO_PAGO_ACCESS_TOKEN')) {
    blockers.push('MERCADO_PAGO_ACCESS_TOKEN ausente.');
  }

  if (!hasEnv('MERCADO_PAGO_PUBLIC_KEY')) {
    warnings.push('MERCADO_PAGO_PUBLIC_KEY ausente.');
  }

  if (!hasEnv('MERCADO_PAGO_WEBHOOK_SECRET_TEST')) {
    warnings.push('Webhook Mercado Pago teste ainda sem secret configurado.');
  }

  if (!hasEnv('EMAIL_DEFAULT_FROM')) {
    warnings.push(
      'EMAIL_DEFAULT_FROM ausente; e-mails usam fallback onboarding@resend.dev.'
    );
  }

  const mercadoPago = await createMercadoPagoPreferenceProbe();

  if (!mercadoPago.ok) {
    blockers.push(`Mercado Pago preference falhou: ${mercadoPago.reason}`);
  }

  const report = {
    ok: blockers.length === 0,
    store: activeStore
      ? {
          name: activeStore.name,
          slug: activeStore.slug,
          status: activeStore.status,
        }
      : null,
    catalog: {
      products: products.length,
      activeProducts: activeProducts.length,
      variants: variants.length,
      variantsMissingShippingDimensions: missingDimensions.length,
    },
    pricing: {
      priceLists: priceLists.map((list) => ({
        name: list.name,
        customerType: list.customer_type,
        status: list.status,
      })),
    },
    shipping: {
      origins: origins.length,
      hasActiveOrigin: Boolean(activeOrigin),
      methods: summarizeMethods(shippingMethods),
      manualFallbackEnabled:
        process.env.ENABLE_MANUAL_SHIPPING_FALLBACK === 'true',
    },
    mercadoPago,
    blockers,
    warnings,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown_error',
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
