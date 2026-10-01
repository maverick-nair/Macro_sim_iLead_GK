import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { OutcomePanel, type OutcomePanelProps, type OutcomePerson } from './OutcomePanel';

const meta: Meta = { title: 'Components/Outcome panel' };
export default meta;

const noop = () => {};
const person = (id: string, name: string): OutcomePerson => ({ id, name, shortName: name.split(' ')[0], img: `/assets/npc/${id}.png` });
const KENT = person('kent', 'Kent Goldberg');
const AFFECTED = [KENT, person('beth', 'Beth Killiney'), person('jack', 'Jack Holt')];
const REACTIONS: Record<string, string> = { kent: 'Feels heard for the first time in weeks.', beth: 'A little unsure about sharing accounts.', jack: 'Noticed you made time for Kent.' };

const BASE: OutcomePanelProps = {
  person: KENT, context: '1:1 with Kent', headline: 'Kent opened up about what is bothering him',
  reply: 'Okay. That would actually help. I can bring Beth up to speed on the old accounts.', onReplay: noop,
  why: {
    cause: 'You apologised, listened, and asked for Kent’s help instead of telling him what to do.',
    rule: 'A 1:1 that acknowledges a missed request and invites contribution lifts Morale 6 to 10 and Trust 4 to 8.',
    evidence: 'I’m sorry I missed it yesterday. I want to hear what’s on your mind, take your time.', judgedByAI: true
  },
  whyOpen: false, onToggleWhy: noop, affected: AFFECTED, revealed: null, onReveal: noop,
  changes: [{ name: 'Kent', metric: 'morale', delta: 8 }, { name: 'Kent', metric: 'trust', delta: 6 }, { name: 'Beth', metric: 'morale', delta: -2 }],
  showNumbers: false, onToggleNumbers: noop, ripple: 'Jack noticed you made time for Kent.',
  changed: ['Kent’s old accounts will flow to Beth again, with Kent as her guide.', 'Kent will update the CRM daily this week.'],
  onDismiss: noop, onOpenHistory: noop
};

/** Every control works: faces reveal reactions, chips switch to numbers, See why expands. */
function Live({ layout, width }: { layout: 'band' | 'card'; width: number }) {
  const [whyOpen, setWhy] = useState(false);
  const [nums, setNums] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  return (
    <div style={{ width }}>
      <OutcomePanel {...BASE} layout={layout} whyOpen={whyOpen} onToggleWhy={() => setWhy(w => !w)} showNumbers={nums} onToggleNumbers={() => setNums(n => !n)}
        revealed={revealed} onReveal={id => setRevealed(r => (r === id ? null : id))}
        reaction={revealed ? { name: revealed[0].toUpperCase() + revealed.slice(1), text: REACTIONS[revealed] } : undefined} />
    </div>
  );
}

/** Desktop band above the board (frame b7 without the profile). */
export const Band: StoryObj = { render: () => <div style={{ width: 1392 }}><OutcomePanel {...BASE} /></div> };
/** Frame r2: why expanded. */
export const BandWhyOpen: StoryObj = { render: () => <div style={{ width: 1392 }}><OutcomePanel {...BASE} whyOpen /></div> };
/** A face tapped: its ring lights and the reaction shows. Chips show exact numbers. */
export const BandReactionAndNumbers: StoryObj = {
  render: () => <div style={{ width: 1392 }}><OutcomePanel {...BASE} revealed="beth" reaction={{ name: 'Beth', text: REACTIONS.beth }} showNumbers /></div>
};
export const BandInteractive: StoryObj = { render: () => <Live layout="band" width={1392} /> };
/** At 1280 the reply and consequences wrap. */
export const BandNarrow: StoryObj = { render: () => <div style={{ width: 1232 }}><OutcomePanel {...BASE} whyOpen /></div> };
/** Only two consequence lines ever show; extras are dropped. */
export const BandLongText: StoryObj = {
  render: () => (
    <div style={{ width: 1392 }}>
      <OutcomePanel {...BASE} headline="Kent opened up about what is bothering him, and asked to lead the handover to Beth himself next week"
        changed={[...BASE.changed, 'This third line is never shown.']}
        reply="Okay. That would actually help. I can bring Beth up to speed on the old accounts, and I would like to sit with her for the first two calls so the clients hear it from me." />
    </div>
  )
};
export const BandNoBystander: StoryObj = { render: () => <div style={{ width: 1392 }}><OutcomePanel {...BASE} affected={[KENT]} ripple="" changes={BASE.changes.slice(0, 2)} /></div> };

/** Frame m6: mobile card. */
export const Card: StoryObj = { render: () => <div style={{ width: 358 }}><OutcomePanel {...BASE} layout="card" /></div> };
export const CardWhyOpen: StoryObj = { render: () => <div style={{ width: 358 }}><OutcomePanel {...BASE} layout="card" whyOpen showNumbers /></div> };
export const CardInteractive: StoryObj = { render: () => <Live layout="card" width={358} /> };
