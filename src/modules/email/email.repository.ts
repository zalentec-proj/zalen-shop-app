import 'server-only';

import { createOptionalAdminClient } from '@/lib/supabase/server';
import { logDevOnce } from '@/lib/logging/dev';
import type {
  EmailDeliveryMode,
  EmailDomainStatus,
  EmailMessageStatus,
  EmailProvider,
  StoreEmailMessageInput,
  StoreEmailSettings,
} from './email.types';

type StoreEmailSettingsRow = {
  id: string;
  store_id: string;
  provider: string;
  mode: string;
  status: string;
  sender_name: string;
  sender_email: string;
  reply_to_email: string | null;
  domain: string | null;
  domain_status: string;
  settings_json: Record<string, unknown> | null;
};

const storeEmailSettingsFields =
  'id,store_id,provider,mode,status,sender_name,sender_email,reply_to_email,domain,domain_status,settings_json';

function toProvider(value: string | null | undefined): EmailProvider {
  return value === 'resend' ? 'resend' : 'resend';
}

function toMode(value: string | null | undefined): EmailDeliveryMode {
  return value === 'store_managed' ? 'store_managed' : 'platform_managed';
}

function toDomainStatus(
  value: string | null | undefined
): EmailDomainStatus {
  const allowed: EmailDomainStatus[] = [
    'unverified',
    'pending',
    'verified',
    'failed',
  ];

  return allowed.includes(value as EmailDomainStatus)
    ? (value as EmailDomainStatus)
    : 'unverified';
}

function toMessageStatus(value: EmailMessageStatus): EmailMessageStatus {
  return value;
}

function mapStoreEmailSettings(
  row: StoreEmailSettingsRow
): StoreEmailSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    provider: toProvider(row.provider),
    mode: toMode(row.mode),
    status: row.status === 'disabled' ? 'disabled' : 'active',
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    replyToEmail: row.reply_to_email ?? undefined,
    domain: row.domain ?? undefined,
    domainStatus: toDomainStatus(row.domain_status),
    settings: row.settings_json ?? {},
  };
}

function safeErrorMessage(value: unknown) {
  return value instanceof Error
    ? value.message.replace(/\s+/g, ' ').slice(0, 220)
    : 'email_repository_error';
}

export async function getStoreEmailSettingsFromRepository(
  storeId: string
): Promise<StoreEmailSettings | null> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('store_email_settings')
    .select(storeEmailSettingsFields)
    .eq('store_id', storeId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logDevOnce('email.repository', 'Unable to load store email settings.', {
        code: error.code,
      });
    }

    return null;
  }

  return mapStoreEmailSettings(data as StoreEmailSettingsRow);
}

export async function createEmailMessageInRepository(
  input: StoreEmailMessageInput & { status?: EmailMessageStatus }
): Promise<string | undefined> {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .from('email_messages')
    .insert({
      store_id: input.storeId,
      template_key: input.templateKey,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      provider: input.provider ?? 'resend',
      status: toMessageStatus(input.status ?? 'queued'),
      metadata_json: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (error || !data) {
    logDevOnce('email.repository', 'Unable to create email message log.', {
      code: error?.code ?? 'unknown',
    });

    return undefined;
  }

  return String(data.id);
}

export async function updateEmailMessageStatusInRepository(input: {
  messageId?: string;
  status: EmailMessageStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}) {
  if (!input.messageId) {
    return;
  }

  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return;
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: input.status,
    provider_message_id: input.providerMessageId,
    error_code: input.errorCode,
    error_message: input.errorMessage,
    updated_at: now,
  };

  if (input.status === 'sent') {
    payload.sent_at = now;
  }

  if (input.status === 'delivered') {
    payload.delivered_at = now;
  }

  if (input.status === 'bounced') {
    payload.bounced_at = now;
  }

  if (input.status === 'complained') {
    payload.complained_at = now;
  }

  if (input.status === 'suppressed') {
    payload.suppressed_at = now;
  }

  const { error } = await supabase
    .from('email_messages')
    .update(payload)
    .eq('id', input.messageId);

  if (error) {
    logDevOnce('email.repository', 'Unable to update email message log.', {
      code: error.code,
      message: safeErrorMessage(error),
    });
  }
}

export async function recordResendWebhookEvent(input: {
  eventId: string;
  eventType: string;
  providerMessageId?: string;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    throw new Error('email_webhook_storage_unavailable');
  }

  const { data, error } = await supabase
    .from('email_webhook_events')
    .insert({
      provider: 'resend',
      external_id: input.eventId,
      provider_message_id: input.providerMessageId,
      event_type: input.eventType,
    })
    .select('id')
    .single();

  if (error?.code === '23505') {
    return { duplicate: true as const };
  }

  if (error || !data) {
    throw new Error('email_webhook_event_persistence_failed');
  }

  return { duplicate: false as const, id: String(data.id) };
}

export async function updateEmailMessageFromResendWebhook(input: {
  providerMessageId: string;
  eventId: string;
  status: EmailMessageStatus;
}) {
  const supabase = createOptionalAdminClient();

  if (!supabase) {
    return;
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: input.status,
    last_provider_event_id: input.eventId,
    updated_at: now,
  };

  if (input.status === 'delivered') payload.delivered_at = now;
  if (input.status === 'bounced') payload.bounced_at = now;
  if (input.status === 'complained') payload.complained_at = now;
  if (input.status === 'suppressed') payload.suppressed_at = now;

  await supabase
    .from('email_messages')
    .update(payload)
    .eq('provider', 'resend')
    .eq('provider_message_id', input.providerMessageId);
}
