import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n';
import { LivePacing, StanceCue } from './LiveRead';
import { RolePlayPortrait } from './RolePlayStage';

const html = (node: ReactNode) => renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
const words = (m: string) => m.match(/data-pace="(\w+)"[^>]*>([^<]*)</)?.slice(1);

describe('the live read and pacing (D233)', () => {
  it('says how the person is now, and keeps the first read out of the live region', () => {
    const m = html(<StanceCue name="Kent" stance="opening" />);
    expect(m).toContain('data-stance="opening"');
    expect(m).toContain('How Kent is with you now');
    expect(m).toContain('Opening up');
    expect(m).toMatch(/aria-live="polite"[^>]*><\/span>/);
  });

  it('replaces "Seems frustrated" under the portrait once there is a read', () => {
    const KENT = { id: 'kent', name: 'Kent Goldberg', img: '' };
    expect(html(<RolePlayPortrait person={KENT} mood="frustrated" conversation="yourTurn" />)).toContain('Seems frustrated');
    const m = html(<RolePlayPortrait person={KENT} mood="frustrated" conversation="yourTurn" stance="closing" />);
    expect(m).not.toContain('Seems frustrated');
    expect(m).toContain('Closing down');
  });

  it('counts the exchanges left in plain words, then asks for next steps near the end', () => {
    expect(words(html(<LivePacing pace={{ turnsLeft: 9, turnLimit: 12, closed: false }} />))).toEqual(['left', 'About 9 more exchanges']);
    expect(words(html(<LivePacing pace={{ turnsLeft: 3, turnLimit: 12, closed: false }} />))).toEqual(['left', 'About 3 more exchanges']);
    expect(words(html(<LivePacing pace={{ turnsLeft: 2, turnLimit: 12, closed: false }} />))).toEqual(['wrap', 'Time to agree next steps']);
    expect(words(html(<LivePacing pace={{ turnsLeft: 2, turnLimit: 4, closed: false }} />))).toEqual(['left', 'About 2 more exchanges']);
    expect(words(html(<LivePacing pace={{ turnsLeft: 1, turnLimit: 4, closed: false }} />))).toEqual(['wrap', 'Time to agree next steps']);
    expect(words(html(<LivePacing pace={{ turnsLeft: 5, turnLimit: 12, closed: true }} />))).toEqual(['over', 'The conversation has reached its end']);
    expect(html(<LivePacing pace={{ turnsLeft: 6, turnLimit: 12, closed: false }} />)).toContain('inline-size:50%');
  });

  it('keeps the goal in view beside the conversation when given one', () => {
    expect(html(<LivePacing pace={{ turnsLeft: 6, turnLimit: 12, closed: false }} goal="Find out what is behind the dip" />)).toContain('Your goal: Find out what is behind the dip');
  });
});
