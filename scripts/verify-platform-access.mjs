// Isolated smoke test: real Next.js/SSR and Supabase SDK against a loopback-only
// Auth/Data API fixture. No credentials or production services are required.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const output = await mkdtemp(join(tmpdir(), 'zalen-platform-verification-'));
const stores = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Brasil Drones', slug: 'brasil-drones', status: 'active' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'LB London', slug: 'lb-london', status: 'active' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Private Pilot', slug: 'private-pilot', status: 'planned' },
  ...Array.from({ length: 25 }, (_, i) => ({ id: `pilot-${i}`, name: `Pilot ${String(i).padStart(2, '0')}`, slug: `pilot-${i}`, status: 'inactive' })),
];
const users = Object.fromEntries(['owner', 'admin', 'member', 'unlinked'].map((name, i) => [name, {
  id: `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
  email: `${name}@example.test`, role: 'authenticated', aud: 'authenticated',
  app_metadata: {}, user_metadata: name === 'member' ? { role: 'platform_owner' } : {},
  created_at: '2026-01-01T00:00:00Z',
}]));
let failStoreListing = false;
const requests = [];
function token(user) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.fixture-signature`;
}
function authenticatedUser(request) {
  try {
    const claims = JSON.parse(Buffer.from(request.headers.authorization.split('.')[1], 'base64url').toString());
    return Object.values(users).find((user) => user.id === claims.sub);
  } catch { return undefined; }
}
function respond(response, body, status = 200, total) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...(total !== undefined ? { 'Content-Range': `0-${Math.max(0, total - 1)}/${total}` } : {}) });
  response.end(JSON.stringify(body));
}
const fixture = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  requests.push({ method: request.method, path: url.pathname });
  if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const input = JSON.parse(raw);
    const user = Object.values(users).find((entry) => entry.email === input.email);
    if (!user || input.password !== 'fixture-password-only') return respond(response, { msg: 'Invalid credentials' }, 400);
    return respond(response, { access_token: token(user), refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user });
  }
  if (url.pathname === '/auth/v1/user') return authenticatedUser(request)
    ? respond(response, authenticatedUser(request)) : respond(response, { msg: 'Invalid session' }, 401);
  if (url.pathname === '/auth/v1/logout') { response.writeHead(204); response.end(); return; }
  if (!url.pathname.startsWith('/rest/v1/') || request.method !== 'GET') return respond(response, { message: 'Fixture does not permit this operation' }, 405);

  const table = url.pathname.split('/').at(-1);
  const userId = url.searchParams.get('user_id')?.replace(/^eq\./, '');
  let rows = [];
  if (table === 'platform_users') {
    if (userId === users.owner.id) rows = [{ role: 'platform_owner' }];
    if (userId === users.admin.id) rows = [{ role: 'platform_admin' }];
  }
  if (table === 'store_memberships' && userId === users.member.id) rows = stores.slice(0, 2).map((store) => ({ id: `membership-${store.id}`, store_id: store.id, user_id: userId, role: 'store_owner' }));
  if (table === 'stores') {
    if (failStoreListing) return respond(response, { message: 'Fixture unavailable' }, 503);
    rows = [...stores];
    const ids = url.searchParams.get('id');
    if (ids?.startsWith('in.(')) rows = rows.filter((row) => ids.slice(4, -1).split(',').includes(row.id));
    const slug = url.searchParams.get('slug');
    if (slug?.startsWith('eq.')) rows = rows.filter((row) => row.slug === slug.slice(3));
    const search = url.searchParams.get('name');
    if (search?.startsWith('ilike.')) rows = rows.filter((row) => row.name.toLowerCase().includes(search.slice(7, -1).toLowerCase()));
    rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  const total = rows.length;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? total);
  respond(response, rows.slice(offset, offset + limit), 200, total);
});
fixture.listen(0, '127.0.0.1');
await once(fixture, 'listening');
const fixtureOrigin = `http://127.0.0.1:${fixture.address().port}`;
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
// NEXT_PUBLIC values are embedded during compilation. Build a temporary copy
// with fixture settings, without copying .env files or touching the real build.
const sandbox = join(output, 'app');
await mkdir(sandbox);
await cp('src', join(sandbox, 'src'), { recursive: true });
for (const file of ['package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs']) {
  await copyFile(file, join(sandbox, file));
}
await symlink(join(process.cwd(), 'node_modules'), join(sandbox, 'node_modules'), 'dir');
await symlink(join(process.cwd(), 'public'), join(sandbox, 'public'), 'dir');
await symlink(join(process.cwd(), 'tests'), join(sandbox, 'tests'), 'dir');
await symlink(join(process.cwd(), 'scripts'), join(sandbox, 'scripts'), 'dir');
const environment = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixtureOrigin,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_platform_fixture',
  SUPABASE_SECRET_KEY: 'sb_secret_platform_fixture', SUPABASE_SERVICE_ROLE_KEY: '',
  APP_URL: origin, AUTH_COOKIE_DOMAIN: '', VERCEL_ENV: '', PLATFORM_ROOT_DOMAIN: 'zalenshop.com.br',
};
console.log('Building an isolated application with local fixture settings...');
const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { cwd: sandbox, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
let buildLogs = '';
build.stdout.on('data', (chunk) => { buildLogs += chunk; });
build.stderr.on('data', (chunk) => { buildLogs += chunk; });
const [buildCode] = await once(build, 'exit');
if (buildCode !== 0) {
  console.error(buildLogs.slice(-4000));
  fixture.closeAllConnections();
  fixture.close();
  await rm(sandbox, { recursive: true, force: true });
  process.exit(1);
}
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: sandbox,
  env: environment,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });
let browser;
const checkpoints = [];
try {
  console.log('Checking login, permissions and store listing in Chromium...');
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${origin}/login`)).ok) break; } catch {}
    if (attempt === 99 || server.exitCode !== null) throw new Error('Local Next.js server did not start.');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const login = async (name) => {
    await context.clearCookies();
    await page.goto(`${origin}/login`);
    await page.getByLabel('E-mail', { exact: true }).fill(users[name].email);
    await page.getByLabel('Senha', { exact: true }).fill('fixture-password-only');
    await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  };

  await page.goto(`${origin}/platform/lojas`);
  await page.waitForURL(/\/login\?/);
  assert.equal(new URL(new URL(page.url()).searchParams.get('next'), origin).href, `${origin}/platform/lojas`);
  checkpoints.push('Absent session returns to login with its destination');

  await login('owner');
  await page.waitForURL(/\/platform\/lojas$/);
  await page.getByRole('heading', { name: 'Lojas', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Abrir painel de Brasil Drones' }).getAttribute('href'), `http://brasil-drones.lvh.me:${port}/admin`);
  assert.equal(await page.getByRole('link', { name: 'Abrir painel de Private Pilot' }).count(), 0);
  await page.screenshot({ path: join(output, 'platform-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Próxima', exact: true }).click();
  await page.waitForURL(/page=2/);
  await page.getByText('Private Pilot', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Abrir painel de Private Pilot' }).count(), 0);
  await page.getByLabel('Buscar pelo nome da loja').fill('London');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('link', { name: 'Abrir painel de LB London' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Abrir painel de Brasil Drones' }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'platform-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  checkpoints.push('Owner panel renders, paginates, searches, and fits mobile');

  failStoreListing = true;
  await page.reload();
  await page.getByRole('heading', { name: 'Não foi possível carregar as lojas' }).waitFor();
  failStoreListing = false;
  checkpoints.push('Database failure renders an unavailable state, without demo stores');

  await login('admin');
  await page.waitForURL(/\/platform\/lojas$/);
  checkpoints.push('Global admin also reaches the platform without a store membership');

  await login('member');
  await page.waitForURL(/\/lojas$/);
  await page.getByRole('heading', { name: 'Minhas lojas', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Abrir painel de/ }).count(), 2);
  await page.goto(`${origin}/platform/lojas`);
  await page.waitForURL(/\/lojas\?acesso=restrito/);
  assert.equal((await page.content()).includes('Private Pilot'), false);
  const rsc = await context.request.get(`${origin}/platform/lojas?_rsc=fixture`, { headers: { RSC: '1' } });
  assert.equal((await rsc.text()).includes('Private Pilot'), false);
  checkpoints.push('Store owner sees only memberships; direct/RSC global access is denied despite forged user metadata');

  await login('unlinked');
  await page.waitForURL(/\/lojas$/);
  await page.getByRole('heading', { name: 'Nenhuma loja disponível para esta conta' }).waitFor();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.waitForURL(/\/login$/);
  checkpoints.push('Unlinked account has a safe empty state and can sign out');
  assert.deepEqual(errors, []);
  assert.equal(requests.some(({ path, method }) => path.startsWith('/rest/') && method !== 'GET'), false);
  const report = { checkpoints, screenshots: [join(output, 'platform-desktop.png'), join(output, 'platform-mobile.png')], pageErrors: errors, fixtureRequests: requests.length };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, report: join(output, 'report.json') }, null, 2));
} catch (error) {
  console.error(error.message);
  console.error(logs.slice(-3000));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
  await rm(sandbox, { recursive: true, force: true });
}
