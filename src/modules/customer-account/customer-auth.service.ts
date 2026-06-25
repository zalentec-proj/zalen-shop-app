import 'server-only';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { renderCustomerLoginCodeEmail } from '@/modules/email/email.templates';
import { sendStoreEmail } from '@/modules/email/email.service';
import { linkOrCreateCustomerAccount } from './customer-account.service';

type SupabaseGenerateLinkData = {
  properties?: {
    email_otp?: string;
  };
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/conta';
  }

  if (value.startsWith('/admin') || value.startsWith('/platform')) {
    return '/conta';
  }

  return value;
}

async function generateCustomerEmailOtp(email: string) {
  const supabase = createAdminClient();
  const magicLinkResult = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (!magicLinkResult.error) {
    const data = magicLinkResult.data as SupabaseGenerateLinkData;
    const otp = data.properties?.email_otp;

    if (otp) {
      return otp;
    }
  }

  const signupResult = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    password: crypto.randomUUID(),
  });

  if (signupResult.error) {
    throw signupResult.error;
  }

  const data = signupResult.data as SupabaseGenerateLinkData;
  const otp = data.properties?.email_otp;

  if (!otp) {
    throw new Error('customer_login_otp_missing');
  }

  return otp;
}

export async function requestCustomerLoginCode(input: {
  storeId: string;
  storeName: string;
  email: string;
  baseUrl: string;
  next?: string;
}) {
  const email = normalizeEmail(input.email);
  const next = getSafeNextPath(input.next);
  const code = await generateCustomerEmailOtp(email);
  const accountUrl = `${input.baseUrl}/conta/entrar?next=${encodeURIComponent(next)}`;
  const template = renderCustomerLoginCodeEmail({
    storeName: input.storeName,
    code,
    accountUrl,
  });

  await sendStoreEmail({
    storeId: input.storeId,
    templateKey: 'customer_login_code',
    recipientEmail: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    idempotencyKey: `customer-login-code:${input.storeId}:${email}:${Date.now()}`,
    metadata: {
      next,
    },
  });

  return {
    email,
    next,
  };
}

export async function verifyCustomerLoginCode(input: {
  storeId: string;
  email: string;
  token: string;
}) {
  const email = normalizeEmail(input.email);
  const token = input.token.trim();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error || !data.user) {
    return {
      ok: false,
      errorCode: 'invalid_login_code',
    };
  }

  await linkOrCreateCustomerAccount({
    storeId: input.storeId,
    authUserId: data.user.id,
    email: data.user.email ?? email,
  });

  return {
    ok: true,
  };
}
