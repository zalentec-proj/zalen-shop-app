'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkStoreRole } from '@/modules/auth/auth.service';
import {
  canEncryptMarketingCredentials,
  saveMarketingSettings,
} from '@/modules/marketing/marketing.service';
import type { StoreMarketingSettings } from '@/modules/marketing/marketing.types';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const marketingPath = '/admin/integracoes/marketing';

function redirectWithParam(key: 'saved' | 'error', value: string): never {
  redirect(`${marketingPath}?${key}=${encodeURIComponent(value)}`);
}

function formString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value || undefined;
}

function formEnabled(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function normalizeGoogleAdsConversionId(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.toUpperCase().replace(/^AW-?/, '');
  return /^\d{6,20}$/.test(normalized) ? `AW-${normalized}` : undefined;
}

function validOrUndefined(
  value: string | undefined,
  pattern: RegExp
): string | undefined {
  return value && pattern.test(value) ? value : undefined;
}

function requireValidIds(settings: StoreMarketingSettings) {
  if (
    settings.google_tag_manager.enabled &&
    !settings.google_tag_manager.containerId
  ) {
    throw new Error('invalid_gtm');
  }

  if (settings.ga4.enabled && !settings.ga4.measurementId) {
    throw new Error('invalid_ga4');
  }

  if (
    settings.google_ads.enabled &&
    (!settings.google_ads.conversionId ||
      !settings.google_ads.purchaseConversionLabel)
  ) {
    throw new Error('invalid_google_ads');
  }

  if (settings.meta_pixel.enabled && !settings.meta_pixel.pixelId) {
    throw new Error('invalid_meta_pixel');
  }
}

async function assertCanManageMarketing() {
  const store = await resolveCurrentStoreFromHeaders();
  const role = await checkStoreRole(store.id, ['store_owner', 'store_admin']);

  if (!role.user) {
    redirect(`/login?next=${encodeURIComponent(marketingPath)}`);
  }

  if (!role.allowed) {
    redirectWithParam('error', 'access_denied');
  }

  return store;
}

export async function saveMarketingSettingsAction(formData: FormData) {
  const store = await assertCanManageMarketing();
  const metaCapiToken = formString(formData, 'metaCapiToken');
  const hasMetaCapiToken = formData.get('hasMetaCapiToken') === 'true';
  const removeMetaCapiToken = formData.get('removeMetaCapiToken') === 'on';
  const settings: StoreMarketingSettings = {
    google_tag_manager: {
      enabled: formEnabled(formData, 'gtmEnabled'),
      containerId: validOrUndefined(
        formString(formData, 'gtmContainerId')?.toUpperCase(),
        /^GTM-[A-Z0-9_-]{4,30}$/
      ),
    },
    ga4: {
      enabled: formEnabled(formData, 'ga4Enabled'),
      measurementId: validOrUndefined(
        formString(formData, 'ga4MeasurementId')?.toUpperCase(),
        /^G-[A-Z0-9]{4,20}$/
      ),
      debugMode: formEnabled(formData, 'ga4DebugMode'),
    },
    google_ads: {
      enabled: formEnabled(formData, 'googleAdsEnabled'),
      conversionId: normalizeGoogleAdsConversionId(
        formString(formData, 'googleAdsConversionId')
      ),
      purchaseConversionLabel: validOrUndefined(
        formString(formData, 'googleAdsPurchaseLabel'),
        /^[A-Za-z0-9_-]{4,80}$/
      ),
      enhancedConversionsEnabled: formEnabled(
        formData,
        'enhancedConversionsEnabled'
      ),
    },
    google_merchant_center: {
      enabled: formEnabled(formData, 'merchantEnabled'),
      verificationToken: validOrUndefined(
        formString(formData, 'merchantVerificationToken'),
        /^[A-Za-z0-9_-]{8,160}$/
      ),
      defaultGoogleProductCategory: formString(
        formData,
        'merchantDefaultCategory'
      )?.slice(0, 160),
    },
    meta_pixel: {
      enabled: formEnabled(formData, 'metaPixelEnabled'),
      pixelId: validOrUndefined(
        formString(formData, 'metaPixelId'),
        /^\d{8,30}$/
      ),
    },
    meta_conversions_api: {
      enabled: formEnabled(formData, 'metaCapiEnabled'),
      testEventCode: validOrUndefined(
        formString(formData, 'metaCapiTestEventCode'),
        /^[A-Za-z0-9_-]{4,80}$/
      ),
    },
  };

  if (metaCapiToken && !canEncryptMarketingCredentials()) {
    redirectWithParam('error', 'missing_encryption');
  }

  try {
    requireValidIds(settings);
    await saveMarketingSettings({
      storeId: store.id,
      settings,
      metaCapiCredentials:
        metaCapiToken && !removeMetaCapiToken
          ? { accessToken: metaCapiToken }
          : null,
      preserveMetaCapiCredentials:
        !removeMetaCapiToken && !metaCapiToken && hasMetaCapiToken,
    });
  } catch (error) {
    if (error instanceof Error) {
      redirectWithParam('error', error.message);
    }

    redirectWithParam('error', 'save_failed');
  }

  revalidatePath(marketingPath);
  redirectWithParam('saved', '1');
}
