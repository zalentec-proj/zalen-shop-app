import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';

const ROOT = process.cwd();
loadEnvFiles();

const PORT = Number(process.env.BLING_CALLBACK_PORT ?? 8787);
const CALLBACK_PATH = '/bling/callback';
const BLING_AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const clientId = requiredEnv('BLING_CLIENT_ID');
requiredEnv('BLING_CLIENT_SECRET');
const state = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const authorizeUrl = new URL(BLING_AUTHORIZE_URL);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('client_id', clientId);
authorizeUrl.searchParams.set('state', state);

let handled = false;

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  if (requestUrl.pathname !== CALLBACK_PATH) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const code = requestUrl.searchParams.get('code');
  const returnedState = requestUrl.searchParams.get('state');
  const error = requestUrl.searchParams.get('error');
  if (error || !code || returnedState !== state || handled) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error ?? 'OAuth callback inválido.');
    return;
  }

  handled = true;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<h1>Autorizado</h1><p>Pode voltar ao Codex.</p>');
  console.log('Code recebido. Atualizando todos os NCMs...');
  runUpdate(code);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Callback local: http://localhost:${PORT}${CALLBACK_PATH}`);
  console.log('Use este callback no app Bling separado.');
  console.log('Abra esta URL de autorização:');
  console.log(authorizeUrl.toString());
});

function runUpdate(code) {
  const child = spawn(process.execPath, ['update-all-ncm.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      BLING_AUTH_CODE: code,
      DRY_RUN: 'false',
      NCM_APPROVED: 'true',
    },
    stdio: 'inherit',
  });
  child.on('exit', (exitCode) => server.close(() => process.exit(exitCode ?? 1)));
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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}
