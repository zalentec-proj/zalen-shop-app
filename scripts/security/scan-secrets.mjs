import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.startsWith('coverage/'));

const patterns = [
  { name: 'Mercado Pago access token', expression: /APP_USR-[A-Za-z0-9_-]{25,}/ },
  { name: 'Mercado Pago test token', expression: /TEST-[A-Za-z0-9_-]{25,}/ },
  { name: 'Resend API key', expression: /re_[A-Za-z0-9]{20,}/ },
  { name: 'GitHub token', expression: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { name: 'Supabase service JWT', expression: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/ },
];

const findings = [];

for (const file of files) {
  const contents = readFileSync(file);

  if (contents.subarray(0, 8_192).includes(0)) {
    continue;
  }

  const content = contents.toString('utf8');

  for (const pattern of patterns) {
    if (pattern.expression.test(content)) {
      findings.push(`${pattern.name}: ${file}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Possible secrets detected in tracked files:');
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('No high-confidence secrets detected in tracked files.');
