import { CARD, FOCUS } from '../kit';

/** The words, kept apart so tests and the server's prompt can read the same promise. */
export const INTRO = {
  title: 'What you are building: an iLead simulation',
  what: 'The participant leads a team of 6 to 12 direct reports through a staged work process, over up to 10 weeks. Each week they choose a leadership style and actions for each person: conversations, coaching, feedback, goals, team meetings. Events land, a sponsor watches, and the team works toward a revenue or output target.',
  goodFor: 'Good for: leading people with different skill and morale, coaching and feedback conversations, and leading one team through pressure or change.',
  notYet: 'Not covered yet: stakeholders outside the team (a board, customers, peers), negotiations between several parties, and budget or customer decisions as things the participant controls. If your brief needs them, I will say so.',
  kora: 'I am Kora. A few short questions, typed or recorded, and I will draft it.',
  glossary: [
    ['Leadership lens', 'the model of leadership styles the simulation scores against, for example Readiness Based Leadership.'],
    ['Work process stages', 'the steps the team\'s work moves through, such as Leads, Qualify and Proposal.'],
    ['Pressure point', 'the stage where work gets stuck; the events lean on it.']
  ] as const
};

function Body() {
  return (
    <>
      <p className="m-0 text-14 leading-[1.45]">{INTRO.what}</p>
      <div className="grid grid-cols-2 gap-3 text-13 leading-[1.4] text-author-body max-[700px]:grid-cols-1">
        <p className="m-0">{INTRO.goodFor}</p>
        <p className="m-0">{INTRO.notYet}</p>
      </div>
      <dl className="m-0 text-13 leading-[1.4] text-author-body">
        {INTRO.glossary.map(([term, says]) => (
          <div key={term} className="inline">
            <dt className="inline font-800 text-author-label">{term}: </dt>
            <dd className="m-0 me-2 inline">{says} </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * The journey's first card (D133): what an iLead simulation is, what it suits and what it does not cover
 * yet, with a one line glossary, and Kora's hello, before question 1. Once the chat has started it folds to a
 * line that opens.
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
      <h2 id="ilead-intro" className="m-0 text-16 font-800">{INTRO.title}</h2>
      <Body />
      <p className="m-0 border-t border-solid border-author-ai-line pt-2 text-15">{INTRO.kora}</p>
    </section>
  );
}
