import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../../api';
import type { EngineView, Intent } from '../../engine/contract';
import { parseReport, type ReportView } from '../../engine/reportContract';
import { useI18n, type I18n } from '../../i18n';
import { createSpeech, useSpeech } from '../../speech';
import { answersFor, pickMoments, portraitOf, reflectionKey, saveState, tiersAscending, toneOf } from '../end/display';
import { EndScreen } from '../end/EndScreen';
import type { EndScreenProps } from '../end/types';
import { badgeIcon } from '../gamification/badgeIcons';
import { shelfOrder } from '../gamification/display';
import { useLeaderboard } from '../gamification/leaderboard';
import { cohortRows } from '../end/cohort';
import { CohortPanel } from '../end/CohortPanel';
import type { BadgeChipProps } from '../gamification/Badge';
import '../end/messages';

const PLACEHOLDER = '/assets/npc/placeholder.svg';
type Report = ReportView;
type Submit = Extract<Intent, { type: 'submitReflection' }>;

/** The end screen's content, without the reflection and the buttons' events. */
export type EndContent = Omit<EndScreenProps, 'reflection' | 'onViewReport' | 'onDownload' | 'onEmail'>;

/** What the end screen shows, from the engine's report and view. Display mapping only: every number is the engine's. */
export function endScreenProps({ t, delta }: Pick<I18n, 't' | 'delta'>, view: EngineView, report: Report): EndContent {
  const r = report.results;
  // Conversions against the ideal pace: the funnel's last stage, run total against its cumulative ideal.
  const ideal = report.business.funnel.at(-1)?.cumulativeIdeal;
  const diff = ideal === undefined ? null : r.conversions - Math.round(ideal);
  const badges: BadgeChipProps[] = shelfOrder(view.badges).map(b => ({
    name: b.name,
    status: b.earned ? 'earned' : 'locked',
    detail: b.earned ? b.reason ?? b.description : b.description,
    icon: badgeIcon(b.rule)
  }));
  return {
    periods: report.periods,
    periodUnit: report.periodUnit,
    people: report.people.length,
    tiers: tiersAscending(report.gamificationTiers).map(x => ({ key: x.key, name: x.name })),
    tier: report.score.tier.key,
    score: Math.round(report.score.total),
    scoreMax: Math.round(report.score.max),
    results: {
      revenue: r.revenue, target: r.target, share: r.share, conversions: r.conversions,
      conversionsNote: diff === null ? '' : t('end.results.conversionsNote', { same: String(diff === 0), delta: delta(diff) }),
      conversionsTone: diff === null ? 'neutral' : toneOf(diff),
      kpis: r.kpis.map(k => ({ metric: k.metric, start: k.start, end: k.end }))
    },
    moments: pickMoments(report.moments).map(m => ({
      id: m.id, kind: m.kind, period: m.period, title: m.title,
      img: portraitOf(m.memberId, view.members, report.people, PLACEHOLDER),
      situation: m.situation, behaviour: m.behaviour, quote: m.quote, impact: m.impact, intent: m.intent
    })),
    badges
  };
}

export interface EngineEndProps {
  view: EngineView;
  /** Consent to audio capture, from onboarding or Settings. Without it the mic says voice is off. */
  voiceConsent: boolean;
  /** Sends the reflection; resolves false when it did not go through. */
  send: (intent: Submit) => Promise<boolean>;
  /** A toast. */
  say: (message: string) => void;
  /** The report, in its web or print view. The reflection is saved first. */
  onViewReport: (print: boolean) => void;
  /** The read only board. The reflection is saved first. */
  onLookAtBoard: () => void;
}

/**
 * The end screen in the playable app, from `view.report`. Holds the reflection being written (seeded
 * from what the engine saved), dictation into an answer, and saving: with Save answers, and before
 * leaving for the report or the board (a failed save keeps the participant here, answers intact).
 */
export function EngineEnd({ view, voiceConsent, send, say, onViewReport, onLookAtBoard }: EngineEndProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const api = useApi();
  // The report's contract applies the copy rules to its text (D76).
  const report = useMemo(() => (view.report ? parseReport(view.report) : null), [view.report]);
  const questions = useMemo(() => report?.questions ?? [], [report]);
  const [answers, setAnswers] = useState(() => answersFor(questions, report?.reflection?.answers));
  const [rating, setRating] = useState<number | null>(() => report?.reflection?.rating ?? null);
  /** The reflection as last saved (or as the engine sent it). */
  const [saved, setSaved] = useState(() => reflectionKey(answers, rating));
  const [last, setLast] = useState<'none' | 'saved' | 'error'>(report?.reflection ? 'saved' : 'none');
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [dictating, setDictating] = useState<number | null>(null);
  const latest = useRef({ answers, rating, send, saved });
  useEffect(() => { latest.current = { answers, rating, send, saved }; });

  const provider = useMemo(() => createSpeech('reflection'), []);
  const speech = useSpeech(provider, { consented: voiceConsent, mode: 'pushToTalk' });
  // The cohort leaderboard, when on (off for selection use). Left out while loading and on error.
  const board = useLeaderboard(view);
  const lb = view.gamification.leaderboard;

  // Dictation lands in the answer box once it has been heard, for editing like typed words.
  useEffect(() => {
    if (dictating === null) return;
    if (speech.status === 'review') {
      const said = speech.transcript.trim();
      // The speech controller is an external store: its result lands here (D78 keeps this finding).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (said) setAnswers(a => a.map((x, j) => (j === dictating ? `${x} ${said}`.trim() : x)));
      speech.cancel();
      setDictating(null);
    } else if (speech.status === 'denied' || speech.status === 'unsupported') {
      setDictating(null);
      say(t('end.reflect.micOff'));
    } else if (speech.status === 'idle') {
      setDictating(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.status]);

  // Leaving without saving (the app closing the screen): send what was written, once.
  useEffect(() => () => {
    const { answers: a, rating: r, send: s, saved: k } = latest.current;
    if (reflectionKey(a, r) !== k) void s({ type: 'submitReflection', answers: a.map(x => x.trim()), rating: r });
  }, []);

  if (!report) return <div role="status" className="flex flex-1 items-center justify-center text-14 text-fg-secondary">{t('end.loading')}</div>;

  const dirty = reflectionKey(answers, rating) !== saved;
  const save = async () => {
    const key = reflectionKey(answers, rating);
    if (key === saved) return true;
    setSaving(true);
    const ok = await send({ type: 'submitReflection', answers: answers.map(a => a.trim()), rating });
    setSaving(false);
    if (ok) { setSaved(key); latest.current.saved = key; }
    setLast(ok ? 'saved' : 'error');
    return ok;
  };
  const leave = async (go: () => void) => {
    if (dictating !== null) { speech.cancel(); setDictating(null); }
    if (await save()) go();
  };
  const onMic = (i: number) => {
    // Voice is off until the participant consents (as on the live screen): say where to turn it on.
    if (!voiceConsent) { say(t('board.error', { code: 'noConsent' })); return; }
    if (dictating === i) { speech.stop(); return; }
    if (dictating !== null) speech.cancel();
    setDictating(i);
    void speech.start();
  };
  const email = async () => {
    if (emailing) return;
    setEmailing(true);
    try {
      await api.emailReport();
      say(t('end.email.sent'));
    } catch {
      say(t('end.email.failed'));
    } finally {
      setEmailing(false);
    }
  };

  // While dictating, the words heard so far show in the box after what was there.
  const heard = speech.transcript || speech.partial;
  const shown = dictating === null || !heard ? answers : answers.map((a, j) => (j === dictating ? `${a} ${heard}`.trim() : a));

  return (
    <EndScreen
      {...endScreenProps(i18n, view, report)}
      focusOnOpen
      reflection={{
        questions, answers: shown, rating,
        onAnswer: (i, text) => { if (dictating === i) return; setAnswers(a => a.map((x, j) => (j === i ? text : x))); },
        onRate: setRating,
        dictating,
        onMic,
        save: { state: saveState(dirty, saving, last), busy: saving || !dirty, onSave: () => void save() }
      }}
      onViewReport={() => void leave(() => onViewReport(false))}
      onDownload={() => void leave(() => onViewReport(true))}
      onEmail={() => void email()}
      emailing={emailing}
      onLookAtBoard={() => void leave(onLookAtBoard)}
      cohort={board && <CohortPanel scope={lb.scope} size={lb.size} {...cohortRows(t, board, view.gamification.tiers, lb.size)} />}
    />
  );
}
