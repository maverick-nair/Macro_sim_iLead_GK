import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n';
import { LiveTranscript } from '../liveshell/RolePlayStage';
import type { LiveTurn } from '../liveshell/types';
import { KpiTile } from '../metric/KpiTile';
import { ReasonChip } from '../reason/ReasonChip';
import { LiveCaption } from './LiveCaption';

const html = (node: ReactNode) => renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
/** Text of every live region in the markup, in order. */
const announced = (markup: string) => [...markup.matchAll(/<[^>]*aria-live="polite"[^>]*>([^<]*)</g)].map(m => m[1]);

const KENT = { id: 'kent', name: 'Kent Goldberg', img: '' };
const turn = (p: Partial<LiveTurn>): LiveTurn => ({ id: 't', speaker: KENT, text: 'I need a week.', aiGenerated: true, ...p });

describe('streamed NPC lines reach screen readers once', () => {
  it('keeps the streaming caption out of the live region', () => {
    const m = html(<LiveCaption name="Kent" text="I need" streaming />);
    expect(announced(m)).toEqual(['']);
    expect(m.match(/aria-live/g)).toHaveLength(1);
  });
  it('announces the finished caption line, with the AI persona note', () => {
    expect(announced(html(<LiveCaption name="Kent" text="I need a week." />))).toEqual(['Kent, AI persona: I need a week.']);
    expect(announced(html(<LiveCaption variant="panel" name="Priya" text="Go on." ai={false} />))).toEqual(['Priya: Go on.']);
    expect(announced(html(<LiveCaption name="Kent" text="I need a week." announce={false} />))).toEqual([]);
  });
  it('keeps the transcript quiet while captions announce, and announces finished turns without them', () => {
    const log = (m: string) => m.match(/role="log"[^>]*/)?.[0] ?? '';
    const quiet = html(<LiveTranscript turns={[turn({})]} captionsAnnounce />);
    expect(log(quiet)).toContain('aria-live="off"');
    expect(announced(quiet)).toEqual(['']);
    expect(announced(html(<LiveTranscript turns={[turn({})]} />))).toEqual(['Kent, AI persona: I need a week.']);
    expect(announced(html(<LiveTranscript turns={[turn({ streaming: true })]} />))).toEqual(['']);
    expect(announced(html(<LiveTranscript turns={[turn({ interrupted: true })]} />))).toEqual(['']);
    expect(announced(html(<LiveTranscript turns={[turn({}), turn({ id: 'y', speaker: 'you', text: 'Fine.' })]} />))).toEqual(['']);
  });
  it('offers Replay on NPC turns only when onReplay is given', () => {
    expect(html(<LiveTranscript turns={[turn({})]} />)).not.toContain('Replay this line');
    expect(html(<LiveTranscript turns={[turn({}), turn({ id: 'y', speaker: 'you', text: 'Fine.' })]} onReplay={() => {}} />).match(/Replay this line/g)).toHaveLength(1);
  });
});

describe('metric names are words, not glyphs', () => {
  it('names a KPI tile as a group with its trend in words', () => {
    const m = html(<KpiTile metric="skill" value={62} trend={{ kind: 'direction', direction: 'up' }} />);
    expect(m).toContain('role="group" aria-label="Team skill 62, rising"');
    expect(m).toContain('<span aria-hidden="true">▲</span> rising');
    expect(html(<KpiTile metric="morale" value={54} trend={{ kind: 'delta', delta: -3 }} />)).toContain('aria-label="Team morale 54, down 3"');
  });
  it('says the reason chip direction in words when it shows numbers', () => {
    const m = html(<ReasonChip name="Kent" metric="morale" delta={8} showNumbers onToggle={() => {}} />);
    expect(m).toContain('<span aria-hidden="true" class="text-status-gain">▲</span>');
    expect(m).toContain('<span class="sr-only">up</span>');
  });
});
