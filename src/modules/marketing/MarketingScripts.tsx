import Script from 'next/script';
import type { MarketingRuntimeConfig } from './marketing.types';

type Props = {
  config: MarketingRuntimeConfig;
};

function getGtmScript(containerId: string) {
  const safeContainerId = JSON.stringify(containerId);

  return `
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'default_consent',
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',${safeContainerId});
  `;
}

export function MarketingScripts({ config }: Props) {
  const containerId = config.gtm?.containerId;

  if (!containerId) {
    return (
      <Script id="zalen-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'default_consent',
            ad_storage: 'denied',
            analytics_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
        `}
      </Script>
    );
  }

  return (
    <>
      <Script id="zalen-gtm" strategy="afterInteractive">
        {getGtmScript(containerId)}
      </Script>
      <noscript>
        <iframe
          title="Google Tag Manager"
          src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  );
}
