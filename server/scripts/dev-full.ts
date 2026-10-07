/**
 * `npm run dev:full`: the app (Vite, `--mode server`, http://localhost:5173) and the server (port 8787,
 * restarting on changes) together. Vite forwards the server's paths, so both share one origin and the
 * session cookie. Prints a launch link to open; `npm run server:mint` makes more.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { DEV_LAUNCH_SECRET } from '../src/config';
import { mintLaunchToken } from '../src/auth/launch';

const APP = 'http://localhost:5173';
const env = {
  ...process.env,
  NODE_ENV: 'development', PORT: process.env.PORT ?? '8787', PUBLIC_URL: APP, LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  SQLITE_PATH: process.env.SQLITE_PATH ?? './data/dev.sqlite'
};
const children: ChildProcess[] = [
  spawn('npx', ['tsx', 'watch', '--clear-screen=false', 'server/src/index.ts'], { stdio: 'inherit', env }),
  spawn('npx', ['vite', '--mode', 'server'], { stdio: 'inherit', env: { ...process.env, ILEAD_SERVER_URL: `http://localhost:${env.PORT}` } })
];
const stop = () => { for (const c of children) c.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const c of children) c.on('exit', code => { if (code) stop(); });

const token = await mintLaunchToken({ sub: 'dev-participant', name: 'Jordan Lee', cohort: 'dev-cohort', roles: ['participant'] }, process.env.LAUNCH_SECRET ?? DEV_LAUNCH_SECRET, { ttlSeconds: 24 * 3600 });
const admin = await mintLaunchToken({ sub: 'dev-admin', name: 'Program admin', cohort: 'dev-cohort', roles: ['cohort_admin', 'assessor', 'author'] }, process.env.LAUNCH_SECRET ?? DEV_LAUNCH_SECRET, { ttlSeconds: 24 * 3600 });
setTimeout(() => {
  console.log(`\n  Participant: ${APP}/launch?token=${token}\n  Staff (group report, author chat): ${APP}/launch?token=${admin}\n`);
}, 3000);
