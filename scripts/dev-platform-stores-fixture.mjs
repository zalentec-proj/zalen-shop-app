// Local UI verification against real Next.js + SDK + disposable PostgreSQL.
// Auth is a loopback-only fixture. No .env files, real users or cloud services.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const container = `zalen-platform-ui-${process.pid}`;
const sandbox = await mkdtemp(join(tmpdir(), 'zalen-platform-ui-'));
const port = Number(process.env.PLATFORM_FIXTURE_PORT ?? 3410);
const ids = { owner: '10000000-0000-4000-8000-000000000001', admin: '10000000-0000-4000-8000-000000000002', merchant: '10000000-0000-4000-8000-000000000003' };
const users = Object.fromEntries(Object.entries(ids).map(([role, id]) => [role, { id, email: `${role}@platform.invalid`, aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: role === 'merchant' ? { role: 'platform_owner' } : {} }]));
function run(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { error += data; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(error)));
    child.stdin.end(input);
  });
}
const sql = (source, variables = {}, dbUser = 'supabase_admin') => run(['exec', '-i', container, 'psql', '-U', dbUser, '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', ...Object.entries(variables).flatMap(([key, value]) => ['-v', `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`])], source);
function respond(response, value, status = 200, count) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...(count !== undefined ? { 'Content-Range': `0-${Math.max(0, count - 1)}/${count}` } : {}) });
  response.end(JSON.stringify(value));
}
function claims(request) {
  try { return JSON.parse(Buffer.from(request.headers.authorization.split('.')[1], 'base64url')); } catch { return {}; }
}
const tables = new Set(['stores', 'platform_users', 'store_memberships', 'storefront_drafts', 'storefront_presentations', 'platform_store_profiles', 'products', 'price_lists']);
const api = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const user = Object.values(users).find((value) => value.id === claims(request).sub);
    if (url.pathname === '/auth/v1/user') return respond(response, user ?? { msg: 'Invalid fixture session' }, user ? 200 : 401);
    if (url.pathname.startsWith('/auth/v1/admin/users/')) return respond(response, Object.values(users).find((value) => value.id === url.pathname.split('/').at(-1)) ?? {}, 200);
    if (url.pathname === '/auth/v1/logout') { response.writeHead(204); response.end(); return; }
    const service = request.headers.authorization === 'Bearer sb_secret_platform_fixture';
    if (url.pathname === '/rest/v1/rpc/platform_store_command' && request.method === 'POST') {
      if (!service) return respond(response, { code: '42501' }, 403);
      let raw = ''; for await (const chunk of request) raw += chunk;
      const data = JSON.parse(raw);
      const result = await sql("set role service_role; select public.platform_store_command(:'actor'::uuid, :'action', nullif(:'store','')::uuid, nullif(:'request','')::uuid, :'payload'::jsonb);", { actor: data.p_actor_id, action: data.p_action, store: data.p_store_id ?? '', request: data.p_request_id ?? '', payload: data.p_payload });
      return respond(response, JSON.parse(result));
    }
    if (!url.pathname.startsWith('/rest/v1/') || !['GET', 'HEAD'].includes(request.method)) return respond(response, {}, 404);
    const table = url.pathname.split('/').at(-1);
    if (!tables.has(table)) return respond(response, [], 200, 0);
    const role = service ? 'service_role' : user ? 'authenticated' : 'anon';
    const variables = { claims: { sub: user?.id, role } };
    const predicates = [];
    for (const key of ['id', 'store_id', 'slug', 'user_id', 'status', 'role', 'name', 'customer_type', 'is_default']) {
      const filter = url.searchParams.get(key); if (!filter) continue;
      const variable = `filter_${key}`;
      if (filter.startsWith('eq.')) { variables[variable] = filter.slice(3); predicates.push(`${key}::text = :'${variable}'`); }
      if (filter.startsWith('in.(')) { variables[variable] = filter.slice(4, -1).split(','); predicates.push(`${key}::text in (select jsonb_array_elements_text(:'${variable}'::jsonb))`); }
      if (key === 'name' && filter.startsWith('ilike.')) { variables[variable] = filter.slice(6); predicates.push(`name ilike :'${variable}'`); }
    }
    const result = await sql(`begin; set local role ${role}; set local request.jwt.claims = :'claims'; select coalesce(json_agg(t), '[]') from (select * from public.${table}${predicates.length ? ` where ${predicates.join(' and ')}` : ''}) t; rollback;`, variables);
    const rows = JSON.parse(result);
    if (request.headers.accept?.includes('application/vnd.pgrst.object')) return rows.length === 1 ? respond(response, rows[0]) : respond(response, { code: 'PGRST116', details: '0 rows' }, 406);
    respond(response, rows, 200, rows.length);
  } catch (error) {
    // Fixture diagnostics contain no credentials, and are never production logs.
    process.stderr.write(`Fixture: ${error.message}\n`);
    respond(response, { code: 'fixture_error' }, 500);
  }
});
let next;
async function stop() {
  next?.kill('SIGTERM');
  api.closeAllConnections(); api.close();
  await run(['rm', '--force', container]).catch(() => {});
  await rm(sandbox, { recursive: true, force: true });
}
process.on('SIGINT', async () => { await stop(); process.exit(0); });
process.on('SIGTERM', async () => { await stop(); process.exit(0); });
try {
  await run(['run', '--detach', '--rm', '--name', container, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'public.ecr.aws/supabase/postgres:17.6.1.167']);
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) { try { await run(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 500)); } }
  if (!ready) throw new Error('PostgreSQL fixture not ready');
  await sql('alter table auth.users add column if not exists deleted_at timestamptz;');
  await sql(await readFile('supabase/tests/platform_store_provisioning.bootstrap.sql', 'utf8'), {}, 'postgres');
  await sql(await readFile('supabase/migrations/20261019150054_platform_store_provisioning.sql', 'utf8'), {}, 'postgres');
  await sql(await readFile('supabase/migrations/20261019165113_platform_store_request_store_index.sql', 'utf8'), {}, 'postgres');
  for (const [role, user] of Object.entries(users)) {
    await sql("insert into auth.users(id,email) values(:'id'::uuid, :'email');", { id: user.id, email: user.email });
    if (role !== 'merchant') await sql("insert into public.platform_users(user_id,role) values (:'id'::uuid, :'role');", { id: user.id, role: `platform_${role}` });
  }
  await sql("insert into public.stores(id,name,slug,status) values('00000000-0000-0000-0000-000000000001','Brasil Drones & Parts','brasil-drones','active'); insert into public.price_lists(store_id,name,code,customer_type,is_default) values('00000000-0000-0000-0000-000000000001','PJ empresa','pj_business','pj',true); alter table public.platform_users enable row level security; grant select on public.platform_users to authenticated; create policy own_role on public.platform_users for select to authenticated using(user_id = auth.uid()); grant select on public.platform_users,public.store_memberships to service_role;");
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  await cp('src', join(sandbox, 'src'), { recursive: true });
  for (const file of ['package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs']) await copyFile(file, join(sandbox, file));
  for (const directory of ['node_modules', 'public', 'tests']) await symlink(join(process.cwd(), directory), join(sandbox, directory), 'dir');
  await mkdir(join(sandbox, 'src/app/fixture-session'), { recursive: true });
  await writeFile(join(sandbox, 'src/app/fixture-session/route.ts'), `import { NextResponse } from 'next/server';\nimport { createClient } from '@/lib/supabase/server';\nconst ids = ${JSON.stringify(ids)};\nexport async function GET(request: Request) { const role = new URL(request.url).searchParams.get('role') as keyof typeof ids; if (!ids[role]) return new Response('Fixture role required', { status: 400 }); const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url'); const access_token = encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:ids[role],role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fixture'; const client = await createClient(); await client.auth.setSession({access_token,refresh_token:'fixture-refresh'}); return NextResponse.redirect(new URL('/platform/lojas', 'http://'+request.headers.get('host'))); }\n`);
  const environment = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${api.address().port}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_platform_fixture', SUPABASE_SECRET_KEY: 'sb_secret_platform_fixture', APP_URL: `http://127.0.0.1:${port}`, AUTH_COOKIE_DOMAIN: '', PLATFORM_ROOT_DOMAIN: 'zalenshop.com.br' };
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)], { cwd: sandbox, env: environment, stdio: ['ignore', 'inherit', 'inherit'] });
  process.stdout.write(`Fixture: http://127.0.0.1:${port}/fixture-session?role=owner\nOther roles: admin, merchant. Responsible: merchant@platform.invalid\nTemporary app: ${sandbox}\nDatabase container: ${container}\n`);
  await once(next, 'exit');
} finally { await stop(); }
