import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import {
  createEmailMessageInRepository,
  getStoreEmailSettingsFromRepository,
  updateEmailMessageStatusInRepository,
} from './email.repository';
import type {
  SendStoreEmailInput,
  StoreEmailResult,
  StoreEmailSettings,
} from './email.types';

const resendEndpoint = 'https://api.resend.com/emails';

function parseEmailAddress(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(.*)<([^<>]+)>$/);

  if (!match) {
    return {
      name: undefined,
      email: trimmed,
      formatted: trimmed,
    };
  }

  const name = match[1].trim().replace(/^"|"$/g, '');
  const email = match[2].trim();

  return {
    name,
    email,
    formatted: name ? `${name} <${email}>` : email,
  };
}

function formatAddress(name: string | undefined, email: string) {
  return name ? `${name} <${email}>` : email;
}

function getFallbackSender() {
  const env = getServerEnv();
  const configured = parseEmailAddress(env.EMAIL_DEFAULT_FROM);

  if (configured) {
    return configured.formatted;
  }

  return 'Zalen Shop <onboarding@resend.dev>';
}

function getSenderForStore(settings: StoreEmailSettings | null) {
  if (
    settings?.status === 'active' &&
    settings.domainStatus === 'verified' &&
    settings.senderEmail
  ) {
    return formatAddress(settings.senderName, settings.senderEmail);
  }

  return getFallbackSender();
}

function getReplyToForStore(settings: StoreEmailSettings | null) {
  const env = getServerEnv();

  if (
    settings?.status === 'active' &&
    settings.domainStatus === 'verified' &&
    settings.replyToEmail
  ) {
    return settings.replyToEmail;
  }

  return env.EMAIL_DEFAULT_REPLY_TO;
}

async function parseResendResponse(response: Response) {
  try {
    return (await response.json()) as {
      id?: unknown;
      name?: unknown;
      message?: unknown;
    };
  } catch {
    return {};
  }
}

function toSafeResendError(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, ' ').slice(0, 220);
  }

  return 'resend_send_failed';
}

export async function sendStoreEmail(
  input: SendStoreEmailInput
): Promise<StoreEmailResult> {
  const settings = await getStoreEmailSettingsFromRepository(input.storeId);
  const messageId = await createEmailMessageInRepository(input);
  const env = getServerEnv();

  if (!env.RESEND_API_KEY) {
    await updateEmailMessageStatusInRepository({
      messageId,
      status: 'skipped',
      errorCode: 'resend_api_key_missing',
      errorMessage: 'RESEND_API_KEY is not configured.',
    });

    return {
      ok: false,
      status: 'skipped',
      messageId,
      errorCode: 'resend_api_key_missing',
    };
  }

  try {
    const response = await fetch(resendEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey
          ? { 'Idempotency-Key': input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: getSenderForStore(settings),
        to: [input.recipientEmail],
        reply_to: getReplyToForStore(settings),
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = await parseResendResponse(response);

    if (!response.ok) {
      const errorMessage =
        typeof body.message === 'string'
          ? body.message
          : `resend_http_${response.status}`;

      await updateEmailMessageStatusInRepository({
        messageId,
        status: 'failed',
        errorCode: `resend_http_${response.status}`,
        errorMessage,
      });

      return {
        ok: false,
        status: 'failed',
        messageId,
        errorCode: `resend_http_${response.status}`,
      };
    }

    const providerMessageId =
      typeof body.id === 'string' ? body.id : undefined;

    await updateEmailMessageStatusInRepository({
      messageId,
      status: 'sent',
      providerMessageId,
    });

    return {
      ok: true,
      status: 'sent',
      messageId,
      providerMessageId,
    };
  } catch (error) {
    await updateEmailMessageStatusInRepository({
      messageId,
      status: 'failed',
      errorCode: 'resend_send_failed',
      errorMessage: toSafeResendError(error),
    });

    return {
      ok: false,
      status: 'failed',
      messageId,
      errorCode: 'resend_send_failed',
    };
  }
}
