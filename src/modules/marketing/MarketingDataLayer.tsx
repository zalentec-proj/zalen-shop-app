'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MarketingRuntimeConfig } from './marketing.types';
import {
  denyMarketingConsent,
  ensureMarketingContext,
  grantMarketingConsent,
  hasMarketingConsent,
  pushMarketingEvent,
  shouldLoadDirectMetaPixel,
  type ClientMarketingEvent,
} from './marketing.client';

type Props = {
  config: MarketingRuntimeConfig;
  event?: ClientMarketingEvent;
};

function hasConsentChoice() {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.cookie
    .split('; ')
    .some((row) => row.startsWith('zalen_marketing_consent='));
}

function loadMetaPixel(pixelId: string) {
  if (typeof window === 'undefined' || window.fbq) {
    return;
  }

  const fbq = (...args: unknown[]) => {
    ((fbq as unknown as { queue?: unknown[] }).queue ??= []).push(args);
  };
  (fbq as unknown as { queue: unknown[] }).queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq('consent', 'grant');
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

export function MarketingDataLayer({ config, event }: Props) {
  const [showConsent, setShowConsent] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const eventKey = useMemo(() => JSON.stringify(event ?? null), [event]);

  useEffect(() => {
    const granted = hasMarketingConsent();
    setConsentGranted(granted);
    setShowConsent(!hasConsentChoice());

    if (granted) {
      ensureMarketingContext();
    }
  }, []);

  useEffect(() => {
    if (!event) {
      return;
    }

    const pixelId = config.metaPixel?.pixelId;

    if (consentGranted && pixelId && shouldLoadDirectMetaPixel(config)) {
      loadMetaPixel(pixelId);
    }

    pushMarketingEvent(event);
  }, [config, consentGranted, eventKey, event]);

  useEffect(() => {
    const pixelId = config.metaPixel?.pixelId;

    if (consentGranted && pixelId && shouldLoadDirectMetaPixel(config)) {
      loadMetaPixel(pixelId);
    }
  }, [config, consentGranted]);

  function accept() {
    grantMarketingConsent();
    setConsentGranted(true);
    setShowConsent(false);
  }

  function decline() {
    denyMarketingConsent();
    setConsentGranted(false);
    setShowConsent(false);
  }

  if (!showConsent) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-3xl rounded-lg border border-white/10 bg-[#071124]/95 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-300">
          Usamos cookies de marketing para medir campanhas e melhorar anúncios.
          Você pode aceitar agora ou continuar sem rastreio publicitário.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="h-10 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-200 transition hover:border-white/20"
          >
            Continuar sem
          </button>
          <button
            type="button"
            onClick={accept}
            className="h-10 rounded-lg bg-blue-primary px-4 text-xs font-bold text-white transition hover:bg-[#2f68ff]"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
