import { copyViolations, sanitizeCopy } from '../../../src/i18n/copy';
import { templateSpeaker, type SpeakerContext, type SyntheticSpeaker } from '../../../src/engine/sim/syntheticSpeech';
import { silentLogger, type AnthropicSettings, type ModelSettings } from '../config';
import type { LlmRequest, LlmTransport } from '../llm/transport';
import { loadPrompt, quoteInput, versionOf } from '../prompts';
import type { AiLogger, Provider } from '../types';

/**
 * Synthetic players with AI (D112, docs/CALIBRATION-SYNTHETIC.md): GenieKreator's calibration plays the
 * four personas, and with AI configured a model writes each persona's lines from the persona, the lens,
 * the person's state and the transcript. Same interface as the engine's offline `templateSpeaker`, which is
 * also the fallback whenever the model fails, refuses, or writes something unusable. The lines are then
 * scored by the server's evaluator, so the scoring pipeline itself is under test.
 */

export interface SyntheticPlayerConfig {
  provider: Provider;
  anthropic?: AnthropicSettings;
  /** Overrides of the model settings; the defaults are the NPC role's (fast, low effort). */
  model?: Partial<ModelSettings>;
  logger?: AiLogger;
}

export interface SyntheticPlayer extends SyntheticSpeaker {
  provider: Provider;
  promptVersion: string;
}

export const syntheticPlayerPrompt = () => loadPrompt('synthetic-player');

const FORMAT: Record<string, string> = {
  roleplay: 'a one to one conversation, spoken', chat: 'a chat message thread', email: 'an email you write once', meeting: 'a team meeting, spoken to the whole team',
  sponsor: 'a briefing for your sponsor, the senior leader you report to', interview: 'a job interview where you ask the questions', plan: 'a check in on a written plan you just shared'
};
const LEVEL = ['Beginner (low performer)', 'Developing (average performer)', 'Proficient (high performer)', 'Expert (exceptional performer)'];

/**
 * The request: rules (cached), then the level and lens (stable for a run), then this turn. Everything an
 * author or a player wrote (the persona description, the lens's and people's names, the transcript) goes
 * through `quoteInput`; the persona description rides in the user message in its own tag, never in the
 * system blocks, so it reads as a description of how to play and not as rules.
 */
export function buildSyntheticRequest(ctx: SpeakerContext, settings: ModelSettings): LlmRequest {
  const q = quoteInput;
  const lens = `# Leadership lens: ${q(ctx.lens.title)}\n${ctx.lens.styles.map(s => `- ${q(s.name)}: ${q(s.description)}`).join('\n')}`;
  const persona = `# Persona\nLevel: ${LEVEL[ctx.level]}`;
  const p = ctx.person;
  const intent = ctx.intent ? ctx.lens.styles.find(s => s.key === ctx.intent) : null;
  const lines = [
    `Format: ${FORMAT[ctx.format] ?? ctx.format}`,
    `Action: ${q(ctx.action.name)}`,
    p ? `Person: ${q(p.name)}${p.mood ? `, mood ${q(p.mood)}` : ''}${p.trust !== null ? `, trust in you ${p.trust} of 100` : ''}` : ctx.format === 'meeting' ? `Team present: ${ctx.team.map(q).join(', ')}` : 'Person: your sponsor',
    p && p.skill !== null ? `Their skill ${p.skill}, morale ${p.morale}, result ${p.result} (of 100)` : '',
    p?.needLabel ? `What you read as their need: ${q(p.needLabel)}` : '',
    p?.concern ? `What they have shared about what is bothering them: ${q(p.concern)}` : '',
    intent ? `Style you mean to show: ${q(intent.name)} (${q(intent.short)})` : '',
    ctx.format === 'email' ? `What the email does: ${ctx.emailIntent === 'warn' ? 'raise a concern about their results' : 'recognize their results'}` : '',
    ctx.format === 'sponsor' && ctx.business ? `Where the business stands: ${Math.round(ctx.business.share * 100)}% of the target with ${Math.round(ctx.business.runShare * 100)}% of the run gone; ${ctx.business.behind} stages behind their ideal${ctx.business.risk ? `; the biggest risk is the ${q(ctx.business.risk)} stage` : ''}` : '',
    ctx.promise ? 'Make one small, concrete promise to follow up by a named day.' : '',
    ctx.slip ? 'You slip this time: you blame the person.' : '',
    `This is your line ${ctx.turn + 1} of about ${ctx.turns}.${ctx.turn + 1 >= ctx.turns ? ' Close the conversation.' : ''}`
  ].filter(Boolean).join('\n');
  const said = ctx.transcript.map(t => `${t.by === 'player' ? 'You' : q(t.name)}: ${q(t.text)}`).join('\n');
  const howYouPlay = ctx.describe.trim() ? `<how_you_play>\n${q(ctx.describe.trim())}\n</how_you_play>\n` : '';
  return {
    label: 'synthetic player',
    settings,
    system: [{ text: syntheticPlayerPrompt().text }, { text: `${persona}\n\n${lens}`, cache: true }],
    messages: [{ role: 'user', content: `${howYouPlay}<turn>\n${lines}\n</turn>\n<conversation>\n${said || '(nothing yet)'}\n</conversation>\nWrite your next line.` }]
  };
}

/** The model's line made safe: one paragraph, no quotes around it, the copy rules applied, a sane length. */
export function cleanLine(text: string): string | null {
  const t = sanitizeCopy(text.replace(/^\s*(?:you|manager)\s*:\s*/i, '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim());
  if (!t || t.length > 700 || copyViolations(t).length) return null;
  return t;
}

export function createMockSyntheticPlayer(): SyntheticPlayer {
  return { provider: 'mock', promptVersion: 'synthetic-templates@1', say: ctx => templateSpeaker.say(ctx) };
}

export function createAnthropicSyntheticPlayer(o: { transport: LlmTransport; settings: ModelSettings; logger?: AiLogger }): SyntheticPlayer {
  const log = o.logger ?? silentLogger;
  return {
    provider: 'anthropic',
    promptVersion: versionOf(syntheticPlayerPrompt()),
    async say(ctx) {
      try {
        const r = await o.transport.complete(buildSyntheticRequest(ctx, o.settings));
        if (r.stopReason === 'refusal') throw new Error('refusal');
        const line = cleanLine(r.text);
        if (line) return line;
        log.warn('synthetic player: unusable line; using the template', { persona: ctx.persona, format: ctx.format });
      } catch (e) {
        log.warn('synthetic player: the model call failed; using the template', { persona: ctx.persona, error: String(e) });
      }
      return templateSpeaker.say(ctx);
    }
  };
}

