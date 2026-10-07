/**
 * Mints a signed launch link for testing, as the LMS or GenieKreator would (docs/SERVER.md "Launch").
 *
 *   npm run server:mint -- --sub p-123 --name "Jordan Lee" --cohort spring-26
 *   npm run server:mint -- --sub admin-1 --roles cohort_admin --cohorts '*'
 *   npm run server:mint -- --sub p-123 --json   (the token only, as JSON)
 *
 * Options: --sub (required), --name, --email, --cohort, --cohorts a,b, --storyline, --purpose development|assessment,
 * --theme, --locale, --roles participant,assessor,cohort_admin,author, --attempt new, --redirect /path,
 * --ttl seconds (default 900), --url (default PUBLIC_URL or http://localhost:8787), --secret (default LAUNCH_SECRET).
 */
import { DEV_LAUNCH_SECRET } from '../src/config';
import { mintLaunchToken } from '../src/auth/launch';
import { LaunchClaims, ROLES, type Role } from '../src/auth/principal';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const list = (v?: string) => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined);

const sub = opt('sub');
if (!sub) {
  console.error('Usage: npm run server:mint -- --sub <participant id> [--name "Name"] [--cohort id] [--roles participant] (see server/scripts/mint.ts)');
  process.exit(2);
}
const roles = (list(opt('roles')) ?? ['participant']) as Role[];
for (const r of roles) if (!ROLES.includes(r)) { console.error(`Unknown role ${r}. Roles: ${ROLES.join(', ')}`); process.exit(2); }
const secret = opt('secret') ?? process.env.LAUNCH_SECRET ?? DEV_LAUNCH_SECRET;
const ttl = Number(opt('ttl') ?? 900);
const claims = {
  sub, name: opt('name'), email: opt('email'), cohort: opt('cohort'), cohorts: list(opt('cohorts')), storyline: opt('storyline'),
  purpose: opt('purpose') as 'development' | 'assessment' | undefined, theme: opt('theme'), locale: opt('locale'), roles,
  attempt: (opt('attempt') ?? 'resume') as 'resume' | 'new', redirect: opt('redirect')
};
const clean = Object.fromEntries(Object.entries(claims).filter(([, v]) => v !== undefined));
const check = LaunchClaims.safeParse({ ...clean, exp: Math.floor(Date.now() / 1000) + ttl });
if (!check.success) {
  console.error(check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(2);
}
const token = await mintLaunchToken(clean as unknown as Parameters<typeof mintLaunchToken>[0], secret, { ttlSeconds: ttl, audience: process.env.LAUNCH_AUDIENCE ?? 'ilead' });
const base = (opt('url') ?? process.env.PUBLIC_URL ?? 'http://localhost:8787').replace(/\/$/, '');
if (args.includes('--json')) console.log(JSON.stringify({ token }));
else {
  if (secret === DEV_LAUNCH_SECRET) console.error('(signed with the development secret: set LAUNCH_SECRET to match the server)');
  console.log(`${base}/launch?token=${token}`);
}
