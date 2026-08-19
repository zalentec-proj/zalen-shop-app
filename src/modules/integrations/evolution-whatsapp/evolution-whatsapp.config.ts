import 'server-only';

import { getServerEnv } from '@/lib/env/server';
import {
  EVOLUTION_WHATSAPP_ENVIRONMENT,
  EVOLUTION_WHATSAPP_PROVIDER_KEY,
} from './evolution-whatsapp.types';

export { EVOLUTION_WHATSAPP_ENVIRONMENT, EVOLUTION_WHATSAPP_PROVIDER_KEY };

export function getEvolutionWhatsAppConfig() {
  const env = getServerEnv();
  const baseUrl = env.EVOLUTION_API_BASE_URL?.replace(/\/$/, '');
  const apiKey = env.EVOLUTION_API_GLOBAL_API_KEY;

  return {
    baseUrl,
    apiKey,
    isConfigured: Boolean(baseUrl && apiKey),
  };
}

export const EVOLUTION_WHATSAPP_ADMIN_DETAIL_PATH = '/admin/integracoes/whatsapp';
