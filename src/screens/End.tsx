import { useState } from 'react';
import type { ScreenProps } from '../app/types';
import { EndScreen } from '../components/end/EndScreen';
import type { BadgeChipProps } from '../components/gamification/Badge';
import { END_FIXTURE as FX } from '../data/fixtures';

/**
 * The prototype's end of simulation reflection (port of `project/ilEnd.dc.html`) on the design
 * fixture, for the `/screens` gallery (frame e1). The playable app renders the same screen from the
 * engine's report (`src/components/board/EngineEnd.tsx`).
 */
export function End({ d, app, act }: ScreenProps) {
  const [answers, setAnswers] = useState<string[]>(FX.answers);
  const [rating, setRating] = useState<number | null>(FX.rating);

  // The design shows four of six earned by the end of the simulation; the scenario data is week 2's.
  const badges: BadgeChipProps[] = d.badges.map((b, i) => ({
    name: b.n,
    detail: b.d,
    status: i < 4 ? (b.isNew ? 'new' : 'earned') : 'locked'
  }));

  return (
    <EndScreen
      minHeight={app.minH}
      periods={FX.periods} periodUnit="week" people={FX.people}
      tiers={FX.tiers} tier={FX.tier} score={FX.score} scoreMax={FX.scoreMax}
      results={FX.results}
      moments={FX.moments}
      badges={badges}
      reflection={{
        questions: FX.questions, answers, rating,
        onAnswer: (i, text) => setAnswers(x => x.map((a, j) => (j === i ? text : a))),
        onRate: setRating,
        onMic: () => act.say('Listening. Your words will appear in the box to edit.')
      }}
      onViewReport={() => act.go('report')}
      onDownload={() => act.say('Your PDF report is downloading.')}
      onEmail={() => act.say('Report sent to your work email.')}
    />
  );
}
