import type { MarketingContext, MarketingRuntimeConfig } from './marketing.types';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export type ClientMarketingItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
};

export type ClientMarketingEvent = {
  event: string;
  event_id?: string;
  ecommerce?: {
    currency?: string;
    value?: number;
    shipping?: number;
    transaction_id?: string;
    items?: ClientMarketingItem[];
  };
  meta?: {
    eventName: 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';
    contentIds?: string[];
    contentName?: string;
    contentType?: string;
  };
};

const consentCookieName = 'zalen_marketing_consent';
const contextCookieName = 'zalen_marketing_context';
const cookieMaxAge = 60 * 60 * 24 * 90;

function getCookie(name: string) {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

function setCookie(name: string, value: string, maxAge = cookieMaxAge) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'SameSite=Lax',
    location.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function readConsent() {
  return getCookie(consentCookieName) === 'granted';
}

function writeConsent(granted: boolean) {
  setCookie(consentCookieName, granted ? 'granted' : 'denied');
}

function allowedParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 220) : undefined;
}

function buildFbcFromFbclid(fbclid: string | undefined) {
  if (!fbclid) {
    return undefined;
  }

  return `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
}

function readStoredContext(): MarketingContext {
  const raw = getCookie(contextCookieName);

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as MarketingContext;
  } catch {
    return {};
  }
}

function writeContext(context: MarketingContext) {
  setCookie(contextCookieName, encodeURIComponent(JSON.stringify(context)));
}

function captureCurrentContext(): MarketingContext {
  const params = new URLSearchParams(window.location.search);
  const existing = readStoredContext();
  const utm: Record<string, string> = { ...(existing.utm ?? {}) };

  for (const [key, value] of params.entries()) {
    if (key.startsWith('utm_')) {
      const safeValue = allowedParam(value);
      if (safeValue) {
        utm[key] = safeValue;
      }
    }
  }

  const fbclid = allowedParam(params.get('fbclid'));
  const fbc = getCookie('_fbc') ?? existing.clickIds?.fbc ?? buildFbcFromFbclid(fbclid);
  const fbp = getCookie('_fbp') ?? existing.clickIds?.fbp;

  return {
    landingPage: existing.landingPage ?? window.location.href,
    pageUrl: window.location.href,
    referrer: existing.referrer ?? document.referrer,
    capturedAt: new Date().toISOString(),
    consent: {
      analytics: true,
      marketing: true,
      adStorage: true,
      adUserData: true,
      adPersonalization: true,
    },
    utm: Object.keys(utm).length ? utm : undefined,
    clickIds: {
      gclid: allowedParam(params.get('gclid')) ?? existing.clickIds?.gclid,
      gbraid: allowedParam(params.get('gbraid')) ?? existing.clickIds?.gbraid,
      wbraid: allowedParam(params.get('wbraid')) ?? existing.clickIds?.wbraid,
      fbclid: fbclid ?? existing.clickIds?.fbclid,
      fbp,
      fbc,
    },
  };
}

export function grantMarketingConsent() {
  writeConsent(true);
  const context = captureCurrentContext();
  writeContext(context);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: 'consent_update',
    ad_storage: 'granted',
    analytics_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  });
  window.fbq?.('consent', 'grant');
  return context;
}

export function denyMarketingConsent() {
  writeConsent(false);
  setCookie(contextCookieName, '', 0);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: 'consent_update',
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.fbq?.('consent', 'revoke');
}

export function hasMarketingConsent() {
  return readConsent();
}

export function ensureMarketingContext() {
  if (!readConsent()) {
    return {};
  }

  const context = captureCurrentContext();
  writeContext(context);
  return context;
}

export function getStoredMarketingContext() {
  return readStoredContext();
}

export function pushMarketingEvent(event: ClientMarketingEvent) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(event as unknown as Record<string, unknown>);

  if (readConsent() && event.meta?.eventName && window.fbq) {
    const metaPayload = {
      content_ids: event.meta.contentIds,
      content_name: event.meta.contentName,
      content_type: event.meta.contentType ?? 'product',
      currency: event.ecommerce?.currency,
      value: event.ecommerce?.value,
      contents: event.ecommerce?.items?.map((item) => ({
        id: item.item_id,
        quantity: item.quantity ?? 1,
        item_price: item.price,
      })),
      num_items: event.ecommerce?.items?.reduce(
        (total, item) => total + (item.quantity ?? 1),
        0
      ),
    };

    window.fbq('track', event.meta.eventName, metaPayload, {
      eventID: event.event_id,
    });
  }
}

export function buildItemEventPayload(item: ClientMarketingItem) {
  return {
    currency: 'BRL',
    value: item.price,
    items: [item],
  };
}

export function shouldLoadDirectMetaPixel(config: MarketingRuntimeConfig) {
  return Boolean(config.metaPixel?.enabled && config.metaPixel.pixelId);
}
