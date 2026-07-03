import 'server-only';

import { createHash } from 'node:crypto';
import type { StoreContext } from '@/modules/stores/store.types';
import type { Order } from '@/modules/orders/order.types';
import {
  canEncryptMarketingCredentials,
  createMarketingEventIfMissingInRepository,
  getMetaCapiCredentialsFromRepository,
  listMarketingIntegrationsFromRepository,
  listRecentMarketingEventsFromRepository,
  updateMarketingEventResultInRepository,
  upsertMarketingIntegrationInRepository,
  type MarketingIntegrationRecord,
  type MetaCapiCredentials,
} from './marketing.repository';
import {
  type MarketingAdminState,
  type MarketingContext,
  type MarketingEventPayload,
  type MarketingItemPayload,
  type MarketingProviderKey,
  type MarketingRuntimeConfig,
  type PurchaseDispatchInput,
  type StoreMarketingSettings,
} from './marketing.types';

const metaGraphEventsBaseUrl = 'https://graph.facebook.com/v25.0';

export const defaultMarketingSettings: StoreMarketingSettings = {
  google_tag_manager: {
    enabled: false,
  },
  ga4: {
    enabled: false,
    debugMode: false,
  },
  google_ads: {
    enabled: false,
    enhancedConversionsEnabled: false,
  },
  google_merchant_center: {
    enabled: false,
  },
  meta_pixel: {
    enabled: false,
  },
  meta_conversions_api: {
    enabled: false,
  },
};

export { canEncryptMarketingCredentials };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function booleanSetting(value: unknown) {
  return value === true || value === 'true' || value === 'on';
}

function stringSetting(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberSetting(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProviderSettings(
  providerKey: MarketingProviderKey,
  settings: Record<string, unknown>,
  hasCredentials = false
): StoreMarketingSettings[MarketingProviderKey] {
  if (providerKey === 'google_tag_manager') {
    return {
      enabled: booleanSetting(settings.enabled),
      containerId: stringSetting(settings.containerId),
    };
  }

  if (providerKey === 'ga4') {
    return {
      enabled: booleanSetting(settings.enabled),
      measurementId: stringSetting(settings.measurementId),
      debugMode: booleanSetting(settings.debugMode),
    };
  }

  if (providerKey === 'google_ads') {
    return {
      enabled: booleanSetting(settings.enabled),
      conversionId: stringSetting(settings.conversionId),
      purchaseConversionLabel: stringSetting(settings.purchaseConversionLabel),
      enhancedConversionsEnabled: booleanSetting(
        settings.enhancedConversionsEnabled
      ),
    };
  }

  if (providerKey === 'google_merchant_center') {
    return {
      enabled: booleanSetting(settings.enabled),
      verificationToken: stringSetting(settings.verificationToken),
      defaultGoogleProductCategory: stringSetting(
        settings.defaultGoogleProductCategory
      ),
    };
  }

  if (providerKey === 'meta_pixel') {
    return {
      enabled: booleanSetting(settings.enabled),
      pixelId: stringSetting(settings.pixelId),
    };
  }

  return {
    enabled: booleanSetting(settings.enabled),
    testEventCode: stringSetting(settings.testEventCode),
    hasToken: hasCredentials,
  };
}

function buildSettingsFromIntegrations(
  integrations: MarketingIntegrationRecord[]
): StoreMarketingSettings {
  const settings: StoreMarketingSettings = structuredClone(defaultMarketingSettings);

  for (const integration of integrations) {
    settings[integration.providerKey] = parseProviderSettings(
      integration.providerKey,
      integration.settings,
      Boolean(integration.credentialsEncrypted)
    ) as never;
  }

  return settings;
}

export async function getStoreMarketingSettings(
  storeId: string
): Promise<StoreMarketingSettings> {
  const integrations = await listMarketingIntegrationsFromRepository(storeId);
  return buildSettingsFromIntegrations(integrations);
}

export async function getMarketingRuntimeConfig(
  store: StoreContext
): Promise<MarketingRuntimeConfig> {
  const settings = await getStoreMarketingSettings(store.id);

  return {
    storeId: store.id,
    storeName: store.name,
    gtm:
      settings.google_tag_manager.enabled &&
      settings.google_tag_manager.containerId
        ? settings.google_tag_manager
        : undefined,
    ga4:
      settings.ga4.enabled && settings.ga4.measurementId
        ? settings.ga4
        : undefined,
    googleAds:
      settings.google_ads.enabled && settings.google_ads.conversionId
        ? settings.google_ads
        : undefined,
    merchantCenter: settings.google_merchant_center.enabled
      ? settings.google_merchant_center
      : undefined,
    metaPixel:
      settings.meta_pixel.enabled && settings.meta_pixel.pixelId
        ? settings.meta_pixel
        : undefined,
  };
}

export async function getMarketingAdminState(
  storeId: string
): Promise<MarketingAdminState> {
  const [integrations, recentEvents] = await Promise.all([
    listMarketingIntegrationsFromRepository(storeId),
    listRecentMarketingEventsFromRepository(storeId),
  ]);

  return {
    settings: buildSettingsFromIntegrations(integrations),
    recentEvents,
    encryptionReady: canEncryptMarketingCredentials(),
  };
}

export async function saveMarketingSettings(input: {
  storeId: string;
  settings: StoreMarketingSettings;
  metaCapiCredentials?: MetaCapiCredentials | null;
  preserveMetaCapiCredentials: boolean;
}) {
  const statusFor = (enabled: boolean, configured: boolean) => {
    if (!enabled) return 'disabled' as const;
    return configured ? 'connected' : 'pending_credentials';
  };

  await Promise.all([
    upsertMarketingIntegrationInRepository({
      storeId: input.storeId,
      providerKey: 'google_tag_manager',
      status: statusFor(
        input.settings.google_tag_manager.enabled,
        Boolean(input.settings.google_tag_manager.containerId)
      ),
      settings: input.settings.google_tag_manager,
      preserveCredentials: false,
    }),
    upsertMarketingIntegrationInRepository({
      storeId: input.storeId,
      providerKey: 'ga4',
      status: statusFor(
        input.settings.ga4.enabled,
        Boolean(input.settings.ga4.measurementId)
      ),
      settings: input.settings.ga4,
      preserveCredentials: false,
    }),
    upsertMarketingIntegrationInRepository({
      storeId: input.storeId,
      providerKey: 'google_ads',
      status: statusFor(
        input.settings.google_ads.enabled,
        Boolean(
          input.settings.google_ads.conversionId &&
            input.settings.google_ads.purchaseConversionLabel
        )
      ),
      settings: input.settings.google_ads,
      preserveCredentials: false,
    }),
    upsertMarketingIntegrationInRepository({
      storeId: input.storeId,
      providerKey: 'google_merchant_center',
      status: statusFor(input.settings.google_merchant_center.enabled, true),
      settings: input.settings.google_merchant_center,
      preserveCredentials: false,
    }),
    upsertMarketingIntegrationInRepository({
      storeId: input.storeId,
      providerKey: 'meta_pixel',
      status: statusFor(
        input.settings.meta_pixel.enabled,
        Boolean(input.settings.meta_pixel.pixelId)
      ),
      settings: input.settings.meta_pixel,
      preserveCredentials: false,
    }),
    upsertMarketingIntegrationInRepository({
      storeId: input.storeId,
      providerKey: 'meta_conversions_api',
      status: statusFor(
        input.settings.meta_conversions_api.enabled,
        Boolean(
          input.settings.meta_pixel.pixelId &&
            (input.metaCapiCredentials?.accessToken ||
              input.preserveMetaCapiCredentials)
        )
      ),
      settings: {
        enabled: input.settings.meta_conversions_api.enabled,
        testEventCode: input.settings.meta_conversions_api.testEventCode,
      },
      credentials: input.metaCapiCredentials,
      preserveCredentials: input.preserveMetaCapiCredentials,
    }),
  ]);
}

export function sanitizeMarketingContext(value: unknown): MarketingContext {
  if (!isRecord(value)) {
    return {};
  }

  const clickIds = isRecord(value.clickIds) ? value.clickIds : {};
  const utm = isRecord(value.utm) ? value.utm : {};
  const consent = isRecord(value.consent) ? value.consent : {};
  const sanitizedUtm = Object.fromEntries(
    Object.entries(utm)
      .map(([key, entryValue]) => [key.slice(0, 48), stringSetting(entryValue)])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .slice(0, 12)
  );

  return {
    landingPage: stringSetting(value.landingPage)?.slice(0, 500),
    pageUrl: stringSetting(value.pageUrl)?.slice(0, 500),
    referrer: stringSetting(value.referrer)?.slice(0, 500),
    capturedAt: stringSetting(value.capturedAt),
    utm: Object.keys(sanitizedUtm).length ? sanitizedUtm : undefined,
    clickIds: {
      gclid: stringSetting(clickIds.gclid),
      gbraid: stringSetting(clickIds.gbraid),
      wbraid: stringSetting(clickIds.wbraid),
      fbclid: stringSetting(clickIds.fbclid),
      fbp: stringSetting(clickIds.fbp),
      fbc: stringSetting(clickIds.fbc),
    },
    consent: {
      analytics: booleanSetting(consent.analytics),
      marketing: booleanSetting(consent.marketing),
      adStorage: booleanSetting(consent.adStorage),
      adUserData: booleanSetting(consent.adUserData),
      adPersonalization: booleanSetting(consent.adPersonalization),
    },
  };
}

export function parseMarketingContextCookie(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    return sanitizeMarketingContext(JSON.parse(decodeURIComponent(value)));
  } catch {
    return {};
  }
}

function toMarketingContext(order: Order) {
  return sanitizeMarketingContext(order.marketingContext);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeBrazilianPhone(value: string | undefined) {
  const digits = value?.replace(/\D/g, '') ?? '';

  if (!digits) {
    return undefined;
  }

  return digits.startsWith('55') ? digits : `55${digits}`;
}

function getHashedUserData(order: Order, context: MarketingContext) {
  if (!context.consent?.adUserData || !context.consent.marketing) {
    return {};
  }

  const email = order.customer?.email?.trim().toLowerCase();
  const phone = normalizeBrazilianPhone(order.customer?.phone);

  return {
    emailSha256: email ? sha256(email) : undefined,
    phoneSha256: phone ? sha256(phone) : undefined,
  };
}

function buildItems(order: Order): MarketingItemPayload[] {
  return order.items.map((item) => ({
    itemId: item.sku ?? item.variantId,
    itemName: item.name,
    sku: item.sku,
    quantity: item.quantity,
    price: item.unitPrice,
  }));
}

function buildPurchasePayload(input: {
  storeId: string;
  order: Order;
  providerKey: MarketingProviderKey;
  pageUrl?: string;
  referrer?: string;
}): MarketingEventPayload {
  const context = toMarketingContext(input.order);
  const hashedUserData = getHashedUserData(input.order, context);

  return {
    storeId: input.storeId,
    providerKey: input.providerKey,
    eventName: 'Purchase',
    eventId: `purchase:${input.storeId}:${input.order.id}`,
    occurredAt: new Date().toISOString(),
    source: 'server',
    pageUrl: input.pageUrl ?? context.pageUrl,
    referrer: input.referrer ?? context.referrer,
    currency: 'BRL',
    value: input.order.total,
    shipping: input.order.shippingTotal,
    orderId: input.order.id,
    orderNumber: input.order.orderNumber,
    items: buildItems(input.order),
    marketingContext: context,
    consent: context.consent,
    hashedUserData:
      hashedUserData.emailSha256 || hashedUserData.phoneSha256
        ? hashedUserData
        : undefined,
  };
}

async function skipEvent(
  payload: MarketingEventPayload,
  reason: string,
  response: Record<string, unknown> = {}
) {
  await updateMarketingEventResultInRepository({
    storeId: payload.storeId,
    providerKey: payload.providerKey,
    eventName: payload.eventName,
    eventId: payload.eventId,
    status: 'skipped',
    response: {
      reason,
      ...response,
    },
  });
}

function buildMetaUserData(payload: MarketingEventPayload) {
  const context = payload.marketingContext;
  const clickIds = context?.clickIds ?? {};
  const userData: Record<string, unknown> = {};

  if (payload.hashedUserData?.emailSha256) {
    userData.em = [payload.hashedUserData.emailSha256];
  }

  if (payload.hashedUserData?.phoneSha256) {
    userData.ph = [payload.hashedUserData.phoneSha256];
  }

  if (clickIds.fbp) {
    userData.fbp = clickIds.fbp;
  }

  if (clickIds.fbc) {
    userData.fbc = clickIds.fbc;
  }

  return userData;
}

async function sendMetaCapiPurchase(input: {
  payload: MarketingEventPayload;
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}) {
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(new Date(input.payload.occurredAt).getTime() / 1000),
    event_id: input.payload.eventId,
    action_source: 'website',
    event_source_url: input.payload.pageUrl,
    user_data: buildMetaUserData(input.payload),
    custom_data: {
      currency: input.payload.currency,
      value: input.payload.value,
      order_id: input.payload.orderId,
      content_type: 'product',
      content_ids: input.payload.items?.map((item) => item.itemId) ?? [],
      contents:
        input.payload.items?.map((item) => ({
          id: item.itemId,
          quantity: item.quantity,
          item_price: item.price,
        })) ?? [],
      num_items:
        input.payload.items?.reduce((total, item) => total + item.quantity, 0) ??
        0,
    },
  };

  const body: Record<string, unknown> = {
    data: [event],
    access_token: input.accessToken,
    partner_agent: 'zalen-shop-nextjs',
  };

  if (input.testEventCode) {
    body.test_event_code = input.testEventCode;
  }

  const response = await fetch(
    `${metaGraphEventsBaseUrl}/${encodeURIComponent(input.pixelId)}/events`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  const responseBody = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new Error(
      `meta_capi_${response.status}_${String(responseBody.error ?? 'error')}`
    );
  }

  return {
    events_received: numberSetting(responseBody.events_received),
    messages: responseBody.messages,
    fbtrace_id: responseBody.fbtrace_id,
  };
}

export async function dispatchPurchaseMarketingEvent(
  input: PurchaseDispatchInput
) {
  const settings = await getStoreMarketingSettings(input.storeId);
  const googleAdsPayload = buildPurchasePayload({
    ...input,
    providerKey: 'google_ads',
  });

  if (settings.google_ads.enabled) {
    const claim = await createMarketingEventIfMissingInRepository(
      googleAdsPayload
    );

    if (claim.created) {
      await skipEvent(googleAdsPayload, 'browser_gtm_managed');
    }
  }

  const pixelId = settings.meta_pixel.pixelId;
  const metaSettings = settings.meta_conversions_api;

  if (!metaSettings.enabled || !pixelId) {
    return;
  }

  const payload = buildPurchasePayload({
    ...input,
    providerKey: 'meta_conversions_api',
  });
  const claim = await createMarketingEventIfMissingInRepository(payload);

  if (!claim.created) {
    return;
  }

  if (!payload.consent?.marketing) {
    await skipEvent(payload, 'missing_marketing_consent');
    return;
  }

  const credentials = await getMetaCapiCredentialsFromRepository({
    storeId: input.storeId,
  }).catch(() => null);

  if (!credentials?.accessToken) {
    await skipEvent(payload, 'missing_meta_capi_token');
    return;
  }

  try {
    const response = await sendMetaCapiPurchase({
      payload,
      pixelId,
      accessToken: credentials.accessToken,
      testEventCode: metaSettings.testEventCode,
    });

    await updateMarketingEventResultInRepository({
      storeId: payload.storeId,
      providerKey: payload.providerKey,
      eventName: payload.eventName,
      eventId: payload.eventId,
      status: 'sent',
      response,
    });
  } catch (error) {
    await updateMarketingEventResultInRepository({
      storeId: payload.storeId,
      providerKey: payload.providerKey,
      eventName: payload.eventName,
      eventId: payload.eventId,
      status: 'error',
      errorMessage:
        error instanceof Error ? error.message.slice(0, 220) : 'meta_capi_error',
    });
  }
}
