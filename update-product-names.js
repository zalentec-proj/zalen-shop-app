import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
loadEnvFiles();

const OUT = path.join(ROOT, 'saida_bling');
const DRY_RUN_FILE = path.join(OUT, '24_nomes_originais_dry_run.json');
const RESULT_FILE = path.join(OUT, '25_resultado_nomes_originais.json');
const REPORT_FILE = path.join(OUT, '08_relatorio_final.md');
const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const STORE_ID = process.env.BLING_STORE_ID ?? '00000000-0000-0000-0000-000000000001';
const PROVIDER_KEY = 'bling';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
const NAMES_APPROVED =
  String(process.env.NAMES_APPROVED ?? process.env.UPDATE_APPROVED ?? 'false').toLowerCase() === 'true';
const REQUEST_DELAY_MS = Number(process.env.BLING_NAMES_DELAY_MS ?? 700);

await main();

async function main() {
  const startedAt = new Date().toISOString();
  const dryRunDocument = JSON.parse(await fs.readFile(DRY_RUN_FILE, 'utf8'));
  const payloads = dryRunDocument.payloads ?? [];
  validatePayloads(payloads);

  const result = {
    status: DRY_RUN || !NAMES_APPROVED ? 'dry_run_only' : 'completed',
    dryRun: DRY_RUN,
    namesApproved: NAMES_APPROVED,
    startedAt,
    finishedAt: null,
    produtosPlanejados: payloads.length,
    atualizados: [],
    errors: [],
    source: {
      dryRunFile: DRY_RUN_FILE,
      sourceOds: dryRunDocument.sourceOds,
      auditWorkbook: dryRunDocument.auditWorkbook,
      updatedWorkbook: dryRunDocument.updatedWorkbook,
    },
    safety: {
      endpoint: 'PATCH /produtos/{idProduto}',
      onlyPayloadField: 'nome',
      skippedWithoutBlingId: dryRunDocument.summary?.semBlingId ?? null,
    },
  };

  if (DRY_RUN || !NAMES_APPROVED) {
    result.atualizados = payloads.map((item) => ({
      linha_ods: item.linha_ods,
      sku: item.sku,
      bling_id: item.bling_id,
      nome_atual: item.nome_atual,
      nome_novo: item.nome_novo,
      status: 'DRY_RUN',
      payload: item.payload_patch_sugerido,
    }));
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(summarize(result), null, 2));
    return;
  }

  const tokenState = await loadTokenState();
  if (!tokenState?.accessToken) {
    throw new Error('Token Bling obrigatório para atualizar nomes.');
  }

  for (const item of payloads) {
    await sleep(REQUEST_DELAY_MS);
    try {
      await bling(tokenState, 'PATCH', `/produtos/${item.bling_id}`, item.payload_patch_sugerido);
      result.atualizados.push({
        linha_ods: item.linha_ods,
        sku: item.sku,
        bling_id: item.bling_id,
        nome_atual: item.nome_atual,
        nome_novo: item.nome_novo,
        status: 'ATUALIZADO',
      });
    } catch (error) {
      const safe = safeError(error);
      result.atualizados.push({
        linha_ods: item.linha_ods,
        sku: item.sku,
        bling_id: item.bling_id,
        nome_atual: item.nome_atual,
        nome_novo: item.nome_novo,
        status: 'ERRO_API',
        error: safe,
      });
      result.errors.push({ sku: item.sku, bling_id: item.bling_id, error: safe });
    }
  }

  result.finishedAt = new Date().toISOString();
  await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await appendReport(result);
  console.log(JSON.stringify(summarize(result), null, 2));
}

function validatePayloads(payloads) {
  if (!Array.isArray(payloads) || payloads.length !== 76) {
    throw new Error(
      `Payload de nomes invalido: esperado 76 produtos com bling_id, recebido ${Array.isArray(payloads) ? payloads.length : 'n/a'}`
    );
  }
  for (const item of payloads) {
    const body = item.payload_patch_sugerido;
    if (!item.bling_id || !item.sku || !body?.nome) {
      throw new Error(`Payload incompleto para SKU ${item.sku ?? 'desconhecido'}`);
    }
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'nome') {
      throw new Error(`Payload inseguro para SKU ${item.sku}: campos ${keys.join(', ')}`);
    }
  }
}

async function loadTokenState() {
  if (process.env.BLING_ACCESS_TOKEN) {
    return {
      accessToken: process.env.BLING_ACCESS_TOKEN,
      refreshToken: process.env.BLING_REFRESH_TOKEN,
      didRefresh: false,
    };
  }

  if (process.env.BLING_AUTH_CODE) return exchangeAuthorizationCode(process.env.BLING_AUTH_CODE);

  const encryptionSecret = requiredEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY');
  const integration = await loadConnectedBlingIntegration();
  const credentials = decryptIntegrationCredentials(integration.credentials_encrypted, encryptionSecret);
  const accessToken = credentials.accessToken ?? credentials.access_token;
  const refreshToken = credentials.refreshToken ?? credentials.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Credenciais Bling salvas estão incompletas.');
  }

  return { accessToken, refreshToken, didRefresh: false };
}

async function exchangeAuthorizationCode(code) {
  const clientId = requiredEnv('BLING_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CLIENT_SECRET');
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
    signal: AbortSignal.timeout(20000),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok || !parsed.access_token) {
    throw new Error(`Troca OAuth Bling falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
  }
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    didRefresh: false,
  };
}

async function loadConnectedBlingIntegration() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? requiredEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('store_integrations')
    .select('environment, status, credentials_encrypted')
    .eq('store_id', STORE_ID)
    .eq('provider_key', PROVIDER_KEY)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Falha ao consultar integração Bling: ${error.message}`);
  if (!data?.credentials_encrypted) {
    throw new Error('Integração Bling conectada não encontrada para Brasil Drones.');
  }

  return data;
}

function decryptIntegrationCredentials(encryptedPayload, secret) {
  const [version, iv, tag, encrypted] = String(encryptedPayload).split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Formato de credencial criptografada não suportado.');
  }

  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

async function refreshAccessToken(tokenState) {
  if (tokenState.didRefresh || !tokenState.refreshToken) {
    throw new Error('Access token Bling expirado. Reconecte o Bling antes de executar o script.');
  }

  const clientId = requiredEnv('BLING_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CLIENT_SECRET');
  const response = await fetch(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenState.refreshToken,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok || !parsed.access_token) {
    throw new Error(`Refresh token Bling falhou: HTTP ${response.status} ${extractBlingError(parsed)}`);
  }

  tokenState.accessToken = parsed.access_token;
  tokenState.refreshToken = parsed.refresh_token;
  tokenState.didRefresh = true;
}

async function bling(tokenState, method, endpoint, body, retriedAuth = false) {
  const response = await fetch(`${BLING_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenState.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (response.status === 401 && !retriedAuth) {
    await refreshAccessToken(tokenState);
    return bling(tokenState, method, endpoint, body, true);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} ${extractBlingError(parsed)}`);
  return parsed;
}

async function appendReport(result) {
  const text = await fs.readFile(REPORT_FILE, 'utf8').catch(() => '');
  const summary = summarize(result);
  const section = [
    '',
    '## Atualizacao de nomes originais no Bling',
    `- Modo: ${result.dryRun ? 'DRY_RUN' : 'ATUALIZACAO REAL'}`,
    `- Produtos planejados: ${result.produtosPlanejados}`,
    `- Produtos atualizados: ${summary.atualizados}`,
    `- Erros: ${summary.errors}`,
    '- Escopo da atualizacao: somente campo nome do produto.',
  ].join('\n');
  await fs.writeFile(REPORT_FILE, `${text.trimEnd()}\n${section}\n`, 'utf8');
}

function summarize(result) {
  return {
    status: result.status,
    produtosPlanejados: result.produtosPlanejados,
    atualizados: result.atualizados.filter((item) => item.status === 'ATUALIZADO').length,
    dryRun: result.atualizados.filter((item) => item.status === 'DRY_RUN').length,
    errors: result.errors.length,
  };
}

function safeError(error) {
  if (error instanceof Error) return error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  return 'unknown_error';
}

function extractBlingError(body) {
  return body?.error?.type ?? body?.error?.message ?? body?.error ?? 'bling_request_failed';
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(ROOT, file);
    if (!existsSync(fullPath)) continue;
    for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
