import { CARD, EYEBROW, FOCUS } from '../kit';

/** The words, kept apart so tests and the server's prompt can read the same promise. */
export const INTRO = {
  title: 'What you are building: an iLead simulation',
  what: 'The participant leads a team of 6 to 12 direct reports through a staged work process, over up to 10 weeks. Each week they choose a leadership style for each person and spend their days on actions: one to one conversations, coaching, feedback, goals and team meetings. Events land along the way, a sponsor watches the results, and the team works toward a revenue or output target.',
  goodFor: 'Good for: leading people with different skill and morale, coaching and feedback conversations, and leading one team through pressure or change.',
  notYet: 'Not covered yet: stakeholders outside the team (a board, customers, peers), negotiations between several parties, and budget or customer decisions as things the participant controls. If your brief needs those, I will say so and suggest the nearest fit.',
  glossary: [
    ['Leadership lens', 'the model of leadership styles the simulation scores against, for example Readiness Based Leadership.'],
    ['Work process stages', 'the steps the team\'s work moves through, such as Leads, Qualify and Proposal.'],
    ['Pressure point', 'the stage where work gets stuck; the events lean on it.']
  ] as const
};

function Body() {
  return (
    <>
      <p className="m-0 text-15 leading-[1.5]">{INTRO.what}</p>
      <p className="m-0 text-14 text-author-body">{INTRO.goodFor}</p>
      <p className="m-0 text-14 text-author-body">{INTRO.notYet}</p>
      <dl className="m-0 grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-13 max-[700px]:grid-cols-1">
        {INTRO.glossary.map(([term, says]) => (
          <div key={term} className="contents">
            <dt className="font-800 text-author-label">{term}</dt>
            <dd className="m-0 text-author-body">{says}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * The journey's first card (D133): what an iLead simulation is, what it suits and what it does not cover
 * yet, with a one line glossary, before question 1. Once the chat has started it folds to a line that opens.
 */
export function Intro({ folded }: { folded: boolean }) {
  if (folded) {
    return (
      <details className={`${CARD} max-w-[47rem] self-start px-4 py-3`}>
        <summary className={`cursor-pointer text-14 font-800 ${FOCUS}`}>{INTRO.title}</summary>
        <div className="mt-2 flex flex-col gap-2"><Body /></div>
      </details>
    );
  }
  return (
    <section aria-labelledby="ilead-intro" className="flex max-w-[47rem] flex-col gap-2 self-start rounded-16 border border-solid border-author-ai-line bg-author-ai-field px-4 py-3">
      <span className={`${EYEBROW} text-author-ai`}>Before we start</span>
      <h2 id="ilead-intro" className="m-0 text-17 font-800">{INTRO.title}</h2>
      <Body />
    </section>
  );
}
