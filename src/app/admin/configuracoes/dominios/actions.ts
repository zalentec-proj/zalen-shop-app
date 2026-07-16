'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  checkStoreRole,
  storeManagementRoles,
} from '@/modules/auth/auth.service';
import {
  activateCustomDomain,
  DomainOperationError,
  removeCustomDomain,
  requestCustomDomain,
  retryCustomDomain,
  verifyCustomDomainNow,
} from '@/modules/domains/domain.service';
import type { DomainActionResult } from '@/modules/domains/domain.types';
import { InvalidDomainHostnameError } from '@/modules/domains/domain-hostname';
import {
  enforceRateLimit,
  getRateLimitErrorMessage,
} from '@/modules/security/rate-limit.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

const actionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('register'),
    hostname: z.string().trim().min(4).max(253),
    preferredPrimary: z.enum(['www', 'apex']),
  }),
  z.object({
    intent: z.literal('verify'),
    domainId: z.string().uuid(),
  }),
  z.object({
    intent: z.literal('retry'),
    domainId: z.string().uuid(),
  }),
  z.object({
    intent: z.literal('activate'),
    domainId: z.string().uuid(),
    confirmed: z.literal('yes'),
  }),
  z.object({
    intent: z.literal('remove'),
    domainId: z.string().uuid(),
    confirmation: z.string().trim().min(1).max(253),
  }),
]);

const messages: Record<string, string> = {
  domain_invalid: 'Informe um domínio válido, sem wildcard, IP ou endereço local.',
  domain_reserved: 'Esse endereço é reservado pela Zalen Shop.',
  domain_taken: 'Esse domínio já está associado a outra loja.',
  domain_not_found: 'O domínio não foi encontrado nesta loja.',
  domain_not_ready: 'O domínio ainda precisa concluir DNS e SSL antes da ativação.',
  domain_confirmation_mismatch: 'Digite exatamente o hostname para confirmar a remoção.',
  domain_self_service_disabled: 'O autosserviço de domínios ainda não está liberado para esta loja.',
  domain_conflict: 'O domínio está associado a outro projeto Vercel. A Zalen não tentará tomá-lo.',
  provider_rate_limited: 'A Vercel limitou temporariamente as consultas. Tente novamente mais tarde.',
  provider_quota: 'O projeto Vercel atingiu um limite para domínios personalizados.',
  provider_unauthorized: 'A credencial server-side da Vercel precisa ser revisada.',
  provider_forbidden: 'A credencial da Vercel não tem permissão para este domínio.',
  provider_timeout: 'A Vercel demorou para responder. A verificação automática tentará novamente.',
  provider_unavailable: 'O serviço de domínios está temporariamente indisponível.',
  storage_unavailable: 'Não foi possível acessar o armazenamento de domínios.',
};

function failure(error: unknown): DomainActionResult {
  const code =
    error instanceof DomainOperationError ||
    error instanceof InvalidDomainHostnameError
      ? error.code
      : error instanceof Error
        ? error.message
        : 'domain_operation_failed';

  return {
    ok: false,
    code,
    message: messages[code] ?? 'Não foi possível concluir a ação. Tente novamente.',
  };
}

export async function manageCustomDomainAction(
  _previousState: DomainActionResult,
  formData: FormData
): Promise<DomainActionResult> {
  const parsed = actionSchema.safeParse({
    intent: formData.get('intent'),
    hostname: formData.get('hostname'),
    preferredPrimary: formData.get('preferredPrimary'),
    domainId: formData.get('domainId'),
    confirmed: formData.get('confirmed'),
    confirmation: formData.get('confirmation'),
  });

  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', message: 'Revise os dados informados.' };
  }

  const store = await resolveCurrentStoreFromHeaders();
  const access = await checkStoreRole(store.id, storeManagementRoles);

  if (!access.allowed || !access.user) {
    return { ok: false, code: 'forbidden', message: 'Seu perfil pode consultar, mas não alterar domínios.' };
  }

  try {
    if (parsed.data.intent === 'register') {
      await requestCustomDomain({
        store,
        actorId: access.user.id,
        hostname: parsed.data.hostname,
        preferredPrimary: parsed.data.preferredPrimary,
      });
    }

    if (parsed.data.intent === 'verify') {
      try {
        await enforceRateLimit({
          scope: 'domain_verify',
          storeId: store.id,
          subject: parsed.data.domainId,
        });
      } catch (error) {
        return { ok: false, code: 'rate_limit', message: getRateLimitErrorMessage(error) };
      }
      await verifyCustomDomainNow({
        store,
        actorId: access.user.id,
        domainId: parsed.data.domainId,
      });
    }

    if (parsed.data.intent === 'retry') {
      await retryCustomDomain({
        store,
        actorId: access.user.id,
        domainId: parsed.data.domainId,
      });
    }

    if (parsed.data.intent === 'activate') {
      await activateCustomDomain({
        store,
        actorId: access.user.id,
        domainId: parsed.data.domainId,
      });
    }

    if (parsed.data.intent === 'remove') {
      await removeCustomDomain({
        store,
        actorId: access.user.id,
        domainId: parsed.data.domainId,
        confirmation: parsed.data.confirmation,
      });
    }

    revalidatePath('/admin/configuracoes/dominios');
    return {
      ok: true,
      message:
        parsed.data.intent === 'register'
          ? 'Domínio cadastrado. Siga os registros DNS exibidos abaixo.'
          : parsed.data.intent === 'activate'
            ? 'Domínio principal atualizado com sucesso.'
            : parsed.data.intent === 'remove'
              ? 'Associação removida da Vercel. O domínio no registrador não foi apagado.'
              : 'Status do domínio atualizado.',
    };
  } catch (error) {
    return failure(error);
  }
}
