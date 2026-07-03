import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Megaphone,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { AdminSidebar } from '@/app/admin/AdminSidebar';
import { logoutAction } from '@/app/login/actions';
import { platformBrand } from '@/lib/branding/platform-brand';
import { canAccessStore, getCurrentUser } from '@/modules/auth/auth.service';
import { getMarketingAdminState } from '@/modules/marketing/marketing.service';
import type { MarketingAdminEvent } from '@/modules/marketing/marketing.types';
import {
  getCurrentOrigin,
  noindexMetadata,
} from '@/modules/seo/seo.service';
import {
  getOptionalStoreFromResolution,
  resolveStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import { saveMarketingSettingsAction } from './actions';

export const metadata: Metadata = {
  title: `${platformBrand.productName} Admin — Marketing`,
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorLabel: Record<string, string> = {
  access_denied: 'Sua conta não possui permissão para gerenciar marketing desta loja.',
  invalid_gtm: 'Revise o ID do GTM. Use o formato GTM-XXXXXXX.',
  invalid_ga4: 'Revise o Measurement ID do GA4. Use o formato G-XXXXXXXX.',
  invalid_google_ads:
    'Revise o Google Ads. Informe Conversion ID e label de compra.',
  invalid_meta_pixel: 'Revise o Pixel ID da Meta. Ele deve conter apenas números.',
  missing_encryption:
    'A criptografia de credenciais precisa estar configurada antes de salvar token CAPI.',
  save_failed: 'Não foi possível salvar as configurações agora.',
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string) {
  if (!value) {
    return 'Sem registro';
  }

  return dateTimeFormatter.format(new Date(value));
}

function statusClass(ready: boolean) {
  return ready
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
    : 'border-amber-400/20 bg-amber-400/10 text-amber-200';
}

function ToggleField({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <input
      type="checkbox"
      name={name}
      defaultChecked={defaultChecked}
      className="h-4 w-4 rounded border-white/20 bg-[#081225] accent-blue-primary"
    />
  );
}

function TextField({
  name,
  label,
  defaultValue,
  placeholder,
  type = 'text',
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-white/10 bg-[#081225] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-primary/70"
      />
    </label>
  );
}

function IntegrationPanel({
  title,
  description,
  ready,
  children,
}: {
  title: string;
  description: string;
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/8 bg-[#0A1730]/95">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(ready)}`}
        >
          {ready ? 'Pronto' : 'Pendente'}
        </span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function EventRow({ event }: { event: MarketingAdminEvent }) {
  const ok = event.status === 'sent' || event.status === 'skipped';

  return (
    <div className="grid gap-2 rounded-lg border border-white/8 bg-[#081225] px-3 py-3 text-xs sm:grid-cols-[110px_minmax(0,1fr)_110px]">
      <span
        className={ok ? 'font-semibold text-emerald-200' : 'font-semibold text-rose-200'}
      >
        {event.status}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">
          {event.providerKey} · {event.eventName}
        </p>
        <p className="truncate text-slate-500">
          {event.orderNumber ?? event.eventId}
        </p>
        {event.errorMessage ? (
          <p className="mt-1 truncate text-rose-200">{event.errorMessage}</p>
        ) : null}
      </div>
      <span className="text-slate-400">{formatDate(event.processedAt ?? event.occurredAt)}</span>
    </div>
  );
}

function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A1730]/90 p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
          Acesso restrito
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Sem permissão</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sua conta não possui acesso para alterar integrações desta loja.
        </p>
        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-blue-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}

export default async function MarketingIntegrationsPage({
  searchParams,
}: PageProps) {
  const params = (await searchParams) ?? {};
  const saved = firstParam(params.saved);
  const error = firstParam(params.error);
  const user = await getCurrentUser();
  const storeResolution = await resolveStoreFromHeaders();
  const store = getOptionalStoreFromResolution(storeResolution);

  if (!store) {
    notFound();
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/integracoes/marketing')}`);
  }

  if (!(await canAccessStore(user.id, store.id))) {
    return <AccessDenied />;
  }

  const [origin, state] = await Promise.all([
    getCurrentOrigin(),
    getMarketingAdminState(store.id),
  ]);
  const { settings } = state;
  const sitemapUrl = `${origin}/sitemap.xml`;
  const robotsUrl = `${origin}/robots.txt`;
  const feedUrl = `${origin}/feeds/google-merchant.xml`;
  const checklist = [
    {
      label: 'GTM instalado',
      ready: Boolean(
        settings.google_tag_manager.enabled &&
          settings.google_tag_manager.containerId
      ),
    },
    {
      label: 'GA4 ecommerce',
      ready: Boolean(settings.ga4.enabled && settings.ga4.measurementId),
    },
    {
      label: 'Google Ads compra',
      ready: Boolean(
        settings.google_ads.enabled &&
          settings.google_ads.conversionId &&
          settings.google_ads.purchaseConversionLabel
      ),
    },
    {
      label: 'Feed Merchant',
      ready: true,
    },
    {
      label: 'Meta Pixel',
      ready: Boolean(settings.meta_pixel.enabled && settings.meta_pixel.pixelId),
    },
    {
      label: 'Meta CAPI',
      ready: Boolean(
        settings.meta_conversions_api.enabled &&
          settings.meta_conversions_api.hasToken
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-[#05070B] text-white xl:pl-60">
      <AdminSidebar
        activeKey="marketing"
        footerLabel="Crescimento"
        footerTitle={store.shortName}
        footerDescription="SEO, feed e mensuração por loja."
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao admin
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-primary/20 bg-blue-primary/10">
                <Megaphone className="h-5 w-5 text-blue-200" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Marketing, SEO e rastreio
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Configuração por loja para tráfego pago, venda confirmada e feed.
                </p>
              </div>
            </div>
          </div>
          <a
            href={sitemapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-white transition hover:border-white/20"
          >
            Sitemap
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {saved ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            Configurações salvas.
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            <TriangleAlert className="h-4 w-4" />
            {errorLabel[error] ?? errorLabel.save_failed}
          </div>
        ) : null}

        <section className="grid gap-3 lg:grid-cols-3">
          {[
            ['Robots', robotsUrl],
            ['Sitemap', sitemapUrl],
            ['Feed Google', feedUrl],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/8 bg-[#0A1730]/95 p-4 transition hover:border-white/20"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {label}
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-white">
                {href}
              </p>
            </a>
          ))}
        </section>

        <form action={saveMarketingSettingsAction} className="grid gap-4">
          <IntegrationPanel
            title="Google Tag Manager"
            description="Container principal para tags do storefront."
            ready={Boolean(settings.google_tag_manager.containerId)}
          >
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="gtmEnabled"
                defaultChecked={settings.google_tag_manager.enabled}
              />
              Ativar GTM
            </label>
            <TextField
              name="gtmContainerId"
              label="Container ID"
              placeholder="GTM-XXXXXXX"
              defaultValue={settings.google_tag_manager.containerId}
            />
          </IntegrationPanel>

          <IntegrationPanel
            title="GA4 e Google Ads"
            description="Eventos ecommerce, conversão de compra e enhanced conversions."
            ready={Boolean(settings.ga4.measurementId || settings.google_ads.conversionId)}
          >
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField name="ga4Enabled" defaultChecked={settings.ga4.enabled} />
              Ativar GA4
            </label>
            <TextField
              name="ga4MeasurementId"
              label="GA4 Measurement ID"
              placeholder="G-XXXXXXXX"
              defaultValue={settings.ga4.measurementId}
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="googleAdsEnabled"
                defaultChecked={settings.google_ads.enabled}
              />
              Ativar Google Ads
            </label>
            <TextField
              name="googleAdsConversionId"
              label="Conversion ID"
              placeholder="AW-123456789"
              defaultValue={settings.google_ads.conversionId}
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="enhancedConversionsEnabled"
                defaultChecked={settings.google_ads.enhancedConversionsEnabled}
              />
              Enhanced conversions
            </label>
            <TextField
              name="googleAdsPurchaseLabel"
              label="Label compra"
              placeholder="abcDEFghi_JKL"
              defaultValue={settings.google_ads.purchaseConversionLabel}
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="ga4DebugMode"
                defaultChecked={settings.ga4.debugMode}
              />
              DebugView GA4
            </label>
          </IntegrationPanel>

          <IntegrationPanel
            title="Google Merchant Center"
            description="Feed público para Shopping, listagens gratuitas e Performance Max."
            ready
          >
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="merchantEnabled"
                defaultChecked={settings.google_merchant_center.enabled}
              />
              Ativar Merchant
            </label>
            <TextField
              name="merchantVerificationToken"
              label="Site verification"
              placeholder="token"
              defaultValue={settings.google_merchant_center.verificationToken}
            />
            <TextField
              name="merchantDefaultCategory"
              label="Categoria padrão Google"
              placeholder="Electronics > Cameras & Optics"
              defaultValue={
                settings.google_merchant_center.defaultGoogleProductCategory
              }
            />
          </IntegrationPanel>

          <IntegrationPanel
            title="Meta Pixel e CAPI"
            description="Eventos de browser e compra confirmada server-side com deduplicação."
            ready={Boolean(
              settings.meta_pixel.pixelId &&
                settings.meta_conversions_api.hasToken
            )}
          >
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="metaPixelEnabled"
                defaultChecked={settings.meta_pixel.enabled}
              />
              Ativar Pixel
            </label>
            <TextField
              name="metaPixelId"
              label="Pixel ID"
              placeholder="123456789012345"
              defaultValue={settings.meta_pixel.pixelId}
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField
                name="metaCapiEnabled"
                defaultChecked={settings.meta_conversions_api.enabled}
              />
              Ativar CAPI
            </label>
            <TextField
              name="metaCapiToken"
              label={
                settings.meta_conversions_api.hasToken
                  ? 'Token CAPI configurado'
                  : 'Token CAPI'
              }
              type="password"
              placeholder={
                settings.meta_conversions_api.hasToken
                  ? 'Preencha apenas para trocar'
                  : 'Cole o token'
              }
            />
            <input
              type="hidden"
              name="hasMetaCapiToken"
              value={settings.meta_conversions_api.hasToken ? 'true' : 'false'}
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <ToggleField name="removeMetaCapiToken" />
              Remover token salvo
            </label>
            <TextField
              name="metaCapiTestEventCode"
              label="Test event code"
              placeholder="TEST123"
              defaultValue={settings.meta_conversions_api.testEventCode}
            />
          </IntegrationPanel>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#0A1730]/95 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-blue-200" />
              {state.encryptionReady
                ? 'Cofre de credenciais ativo.'
                : 'Cofre de credenciais pendente no ambiente.'}
            </div>
            <button
              type="submit"
              className="h-11 rounded-lg bg-blue-primary px-5 text-sm font-bold text-white transition hover:bg-[#2f68ff]"
            >
              Salvar configurações
            </button>
          </div>
        </form>

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-lg border border-white/8 bg-[#0A1730]/95 p-4">
            <h2 className="text-base font-semibold">Checklist</h2>
            <div className="mt-4 space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#081225] px-3 py-2 text-xs"
                >
                  <span className="text-slate-300">{item.label}</span>
                  <span
                    className={item.ready ? 'text-emerald-200' : 'text-amber-200'}
                  >
                    {item.ready ? 'OK' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/8 bg-[#0A1730]/95 p-4">
            <h2 className="text-base font-semibold">Últimos eventos</h2>
            <div className="mt-4 space-y-2">
              {state.recentEvents.length > 0 ? (
                state.recentEvents.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))
              ) : (
                <p className="rounded-lg border border-white/8 bg-[#081225] px-3 py-4 text-sm text-slate-400">
                  Nenhum evento server-side registrado ainda.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
