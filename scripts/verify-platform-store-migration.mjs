// An isolated PostgreSQL test. Never reads .env or connects to a cloud database.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const name = `zalen-platform-test-${process.pid}`;
const image = 'public.ecr.aws/supabase/postgres:17.6.1.167';
async function docker(args, stdin = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(output)));
    child.stdin.end(stdin);
  });
}
async function sql(source, user = 'postgres') {
  return docker(['exec', '-i', name, 'psql', '-U', user, '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], source);
}
try {
  await docker(['run', '--detach', '--rm', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image]);
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { await docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error('PostgreSQL local não iniciou.');
  // The cached base image predates GoTrue's deleted_at column.
  await sql('alter table auth.users add column if not exists deleted_at timestamptz;', 'supabase_admin');
  await sql(await readFile(new URL('../supabase/tests/platform_store_provisioning.bootstrap.sql', import.meta.url), 'utf8'));
  await sql(await readFile(new URL('../supabase/migrations/20261019150054_platform_store_provisioning.sql', import.meta.url), 'utf8'));
  await sql(await readFile(new URL('../supabase/migrations/20261019165113_platform_store_request_store_index.sql', import.meta.url), 'utf8'));
  const result = await sql(await readFile(new URL('../supabase/tests/platform_store_provisioning.sql', import.meta.url), 'utf8'), 'supabase_admin');
  process.stdout.write(result);
  await sql("insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','owner@concurrency.invalid'),('10000000-0000-4000-8000-000000000002','merchant@concurrency.invalid'); insert into public.platform_users values('10000000-0000-4000-8000-000000000001','platform_owner');", 'supabase_admin');
  const simultaneous = `set role service_role; select public.platform_store_command('10000000-0000-4000-8000-000000000001','create',null,'10000000-0000-4000-8000-000000000003','{"name":"Concurrent pilot","slug":"concurrent-pilot","ownerEmail":"merchant@concurrency.invalid","config":{"renderer":"neutral"}}');`;
  await Promise.all([sql(simultaneous), sql(simultaneous)]);
  await sql("do $$ begin assert (select count(*)=1 from public.stores), 'concurrent store duplication'; assert (select count(*)=1 from public.store_memberships), 'concurrent membership duplication'; assert (select count(*)=2 from public.price_lists), 'concurrent default duplication'; end $$;");
  process.stdout.write('Concurrent duplicate submissions passed.\n');
  process.stdout.write('Platform stores: atomicity, idempotency, draft/publish and Data API isolation passed.\n');
} finally {
  await docker(['rm', '--force', name]).catch(() => {});
}
