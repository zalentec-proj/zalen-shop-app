import 'server-only';

import { randomUUID } from 'node:crypto';
import { getEvolutionWhatsAppConfig } from './evolution-whatsapp.config';
import type { EvolutionConnectionResult, EvolutionInstanceSummary } from './evolution-whatsapp.types';

const requestTimeoutMs = 15_000;

export class EvolutionWhatsAppClientError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(`evolution_whatsapp_request_failed:${status}:${reason}`);
    this.name = 'EvolutionWhatsAppClientError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeState(value: unknown): EvolutionConnectionResult['status'] {
  if (value === 'open' || value === 'close' || value === 'connecting') return value;
  return 'unknown';
}

function getSafeResponseReason(payload: unknown) {
  const record = asRecord(payload);
  return asString(record.message) ?? asString(record.error) ?? 'request_failed';
}

export class EvolutionWhatsAppClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(input?: { baseUrl?: string; apiKey?: string }) {
    const config = getEvolutionWhatsAppConfig();
    this.baseUrl = input?.baseUrl ?? config.baseUrl ?? '';
    this.apiKey = input?.apiKey ?? config.apiKey ?? '';

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('evolution_whatsapp_not_configured');
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.apiKey,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
      cache: 'no-store',
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new EvolutionWhatsAppClientError(response.status, getSafeResponseReason(body));
    }

    return body as T;
  }

  async listInstances(): Promise<EvolutionInstanceSummary[]> {
    const body = await this.request<unknown>('/instance/fetchInstances');
    const list = Array.isArray(body)
      ? body
      : Array.isArray(asRecord(body).instances)
        ? (asRecord(body).instances as unknown[])
        : [];

    return list
      .map((item) => asRecord(item))
      .map((item) => ({
        id: asString(item.id),
        name: asString(item.name) ?? asString(item.instanceName) ?? '',
        connectionStatus: normalizeState(item.connectionStatus ?? item.status),
        ownerPhone: asString(item.ownerJid)?.replace(/@.+$/, ''),
        profileName: asString(item.profileName),
      }))
      .filter((item) => Boolean(item.name));
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionResult> {
    const body = asRecord(
      await this.request<unknown>(`/instance/connectionState/${encodeURIComponent(instanceName)}`)
    );
    const instance = asRecord(body.instance);

    return {
      status: normalizeState(instance.state ?? instance.connectionStatus ?? body.state),
      ownerPhone: asString(instance.ownerJid)?.replace(/@.+$/, ''),
    };
  }

  async createInstance(input: { instanceName: string; instanceToken?: string }) {
    const body = asRecord(
      await this.request<unknown>('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: input.instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          token: input.instanceToken ?? randomUUID(),
        }),
      })
    );
    const instance = asRecord(body.instance);
    const qrCode = asRecord(body.qrcode);

    return {
      instanceId: asString(instance.instanceId) ?? asString(instance.id),
      status: normalizeState(instance.status),
      qrCodeDataUrl: asString(qrCode.base64),
    };
  }

  async reconnect(instanceName: string): Promise<EvolutionConnectionResult> {
    const body = asRecord(
      await this.request<unknown>(`/instance/connect/${encodeURIComponent(instanceName)}`)
    );
    const qrCode = asRecord(body.qrcode);
    const instance = asRecord(body.instance);

    return {
      status: normalizeState(instance.status ?? body.status),
      qrCodeDataUrl: asString(qrCode.base64) ?? asString(body.base64),
    };
  }

  async setWebhook(input: { instanceName: string; url: string; secret: string }) {
    await this.request<unknown>(`/webhook/set/${encodeURIComponent(input.instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: input.url,
          webhookByEvents: false,
          webhookBase64: false,
          events: ['CONNECTION_UPDATE', 'MESSAGES_UPDATE'],
          headers: { 'x-zalen-webhook-secret': input.secret },
        },
      }),
    });
  }

  async sendText(input: { instanceName: string; phoneE164: string; text: string }) {
    const number = input.phoneE164.replace(/\D/g, '');
    const body = asRecord(
      await this.request<unknown>(
        `/message/sendText/${encodeURIComponent(input.instanceName)}`,
        {
          method: 'POST',
          body: JSON.stringify({ number, text: input.text }),
        }
      )
    );
    const key = asRecord(body.key);

    return {
      providerMessageId: asString(key.id) ?? asString(body.id),
    };
  }
}
