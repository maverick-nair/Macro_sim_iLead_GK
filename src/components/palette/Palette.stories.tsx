import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CommandPalette, type PaletteResult } from './CommandPalette';

const meta: Meta = { title: 'Components/Command palette' };
export default meta;

const noop = () => {};
const ALL: PaletteResult[] = [
  { id: 'kent', name: 'Kent Goldberg', detail: 'Senior Sales Development Rep', img: '/assets/npc/kent.png', tone: 'warm', onRun: noop },
  { id: 'beth', name: 'Beth Killiney', detail: 'Sales Development Rep', img: '/assets/npc/beth.png', tone: 'calm', onRun: noop },
  { id: 'peter', name: 'Peter Higgins', detail: 'Account Qualifier', img: '/assets/npc/peter.png', tone: 'away', onRun: noop },
  { id: 'justin', name: 'Justin Keel', detail: 'Proposal Writer', img: '/assets/npc/justin.png', tone: 'calm', onRun: noop },
  { id: 'meet', name: 'Meet the team', detail: '1 day', tone: 'brand', onRun: noop },
  { id: 'energize', name: 'Energize the team', detail: '½ day', tone: 'brand', onRun: noop },
  { id: 'email', name: 'Send email', detail: 'No days', tone: 'brand', onRun: noop },
  { id: 'training', name: 'Send for training', detail: '2 days', tone: 'brand', onRun: noop }
];

/** The palette covers the board it sits in, so stories give it a positioned box. */
function Board({ initial = '', open: startOpen = true, height = 640 }: { initial?: string; open?: boolean; height?: number }) {
  const [open, setOpen] = useState(startOpen);
  const [q, setQ] = useState(initial);
  const [ran, setRan] = useState('');
  const term = q.trim().toLowerCase();
  const results = ALL.filter(r => !term || r.name.toLowerCase().includes(term)).map(r => ({ ...r, onRun: () => { setRan(r.name); setOpen(false); } }));
  return (
    <div style={{ position: 'relative', height, borderRadius: 16, border: '1px dashed var(--il-color-line-strong)', padding: 16 }}>
      <button type="button" onClick={() => { setQ(''); setOpen(true); }}>Open palette</button>
      {ran && <p>Ran: {ran}</p>}
      <CommandPalette open={open} onClose={() => setOpen(false)} query={q} onQueryChange={setQ} results={results} />
    </div>
  );
}

/** Opened with no query: every result, none highlighted. */
export const Open: StoryObj = { render: () => <Board /> };
/** Searching highlights the first result; Enter runs it. */
export const Searching: StoryObj = { render: () => <Board initial="ke" /> };
export const ActionsOnly: StoryObj = { render: () => <Board initial="team" /> };
/** No matches: the list is empty and screen readers hear "No results". */
export const NoResults: StoryObj = { render: () => <Board initial="zz" /> };
/** Escape, a click on the scrim or running a result closes it; focus goes back to the button. */
export const Closed: StoryObj = { render: () => <Board open={false} /> };
export const Mobile: StoryObj = { render: () => <div style={{ width: 390 }}><Board initial="e" height={700} /></div> };
