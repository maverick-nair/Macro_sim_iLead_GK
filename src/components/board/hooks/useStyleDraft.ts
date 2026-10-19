import { useState } from 'react';
import type { Intent, MemberView, StyleKey } from '../../../engine/contract';
import type { StyleSettingLayout, StyleSettingViewMode } from '../../stylesetting/StyleSettingView';

type Draft = Record<string, StyleKey>;
type Notes = Record<string, string>;
type ConfirmStyles = Extract<Intent, { type: 'confirmStyles' }>;

/** The confirm intent for a draft: notes go only where something was written. */
export function styleIntent(draft: Draft, notes: Notes): ConfirmStyles {
  const given = Object.fromEntries(Object.entries(notes).filter(([, n]) => n.trim()));
  return { type: 'confirmStyles', styles: draft, notes: Object.keys(given).length ? given : undefined };
}

interface Input {
  /** The period on the clock: a new one clears the draft. */
  period: number;
  /** The demo's styles for everyone but the person it is about (D92). */
  prefill?: Draft;
  members: MemberView[];
  send: (i: Intent) => Promise<unknown>;
  /** Runs with the period reset, for what else a new period clears (a half planned action). */
  onPeriodChange: () => void;
}

/** The weekly style setting's draft: each person's style and rationale, the layout and summary, and Confirm. */
export function useStyleDraft({ period, prefill, members, send, onPeriodChange }: Input) {
  const [draft, setDraft] = useState<Draft>(() => prefill ?? {});
  const [notes, setNotes] = useState<Notes>({});
  const [styleView, setStyleView] = useState<{ layout: StyleSettingLayout; summary: boolean }>({ layout: 'cards', summary: false });

  // A new period clears the style draft and any half planned action.
  const [draftPeriod, setDraftPeriod] = useState(period);
  if (draftPeriod !== period) {
    setDraftPeriod(period);
    setDraft({}); setNotes({}); setStyleView(x => ({ ...x, summary: false })); onPeriodChange();
  }

  const chosen = members.filter(m => draft[m.id]).length;
  const confirm = () => {
    if (chosen !== members.length) return;
    void send(styleIntent(draft, notes));
  };
  const setStyle = (id: string, k: StyleKey) => setDraft(d => ({ ...d, [id]: k }));
  const setRationale = (id: string, text: string) => setNotes(n => ({ ...n, [id]: text }));
  const changeView = (m: StyleSettingViewMode) => setStyleView(x => (m === 'summary' ? { ...x, summary: true } : { layout: m, summary: false }));
  const closeSummary = () => setStyleView(x => ({ ...x, summary: false }));
  return { draft, notes, styleView, chosen, confirm, setStyle, setRationale, changeView, closeSummary };
}
