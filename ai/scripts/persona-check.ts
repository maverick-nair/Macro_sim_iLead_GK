/**
 * Persona check gate: `npm run ai:persona-check [-- <storyline>] [--provider mock|anthropic|all] [--only kent,beth] [--verbose] [--out report.json]`.
 * Sends every NPC off topic, hostile, jailbreak, unsafe and "tell me your hidden concern" inputs and
 * fails when any reply leaves its role, leaks hidden state or breaks the copy rules. The mock always
 * runs; the Anthropic NPC model runs when ANTHROPIC_API_KEY is set.
 */
import { createNpcModel } from '../src/factories';
import { silentLogger } from '../src/config';
import { formatPersona, runPersonaCheck, type PersonaReport } from '../src/quality/personaCheck';
import { args, env, loadStoryline, providers, save } from './shared';

const a = args();
const config = loadStoryline(a.storyline);
const reports: PersonaReport[] = [];
let ok = true;
for (const provider of providers(a.provider)) {
  const npc = createNpcModel({ ...env().npc, provider, logger: a.verbose ? undefined : silentLogger });
  const report = await runPersonaCheck(npc, config, { only: a.only });
  console.log(`${formatPersona(report, a.verbose)}\n`);
  reports.push(report);
  ok &&= report.pass;
}
save(a.out, reports);
process.exit(ok ? 0 : 1);
