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

const state =
  process.env.BLING_AUTH_STATE ??
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Bling OAuth error: ${errorDescription ?? error}`);
    console.error(`Bling OAuth error: ${errorDescription ?? error}`);
    return;
  }

  if (!code) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Callback sem code.');
    console.error('Callback sem code.');
    return;
  }

  if (returnedState !== state) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('State OAuth inválido.');
    console.error('State OAuth inválido.');
    return;
  }

  if (handled) {
    response.writeHead(409, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Code já recebido nesta execução.');
    return;
  }

  handled = true;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<h1>Autorizado</h1><p>Pode voltar ao Codex.</p>');

  console.log('Code recebido. Executando importação real aprovada...');
  runImport(code);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Callback local: http://localhost:${PORT}${CALLBACK_PATH}`);
  console.log('Configure este link no Bling como Link de redirecionamento do app.');
  console.log('Depois abra esta URL de autorização:');
  console.log(authorizeUrl.toString());
});

function runImport(code) {
  const child = spawn(process.execPath, ['import-products.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      BLING_AUTH_CODE: code,
      DRY_RUN: 'false',
      IMPORT_APPROVED: 'true',
    },
    stdio: 'inherit',
  });

  child.on('exit', (exitCode) => {
    server.close(() => {
      process.exit(exitCode ?? 1);
    });
  });
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
