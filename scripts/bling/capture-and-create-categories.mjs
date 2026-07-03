import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

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

  console.log('Code recebido. Trocando por token e criando categorias...');
  runCategoryScript(code);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Callback local: http://localhost:${PORT}${CALLBACK_PATH}`);
  console.log('Configure este link no Bling como Link de redirecionamento do app.');
  console.log('Depois abra esta URL de autorização:');
  console.log(authorizeUrl.toString());
});

function runCategoryScript(code) {
  const child = spawn(
    process.execPath,
    ['scripts/bling/create-brasil-drones-categories.mjs', '--run'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BLING_AUTH_CODE: code,
      },
      stdio: 'inherit',
    }
  );

  child.on('exit', (exitCode) => {
    server.close(() => {
      process.exit(exitCode ?? 1);
    });
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }
  return value;
}
