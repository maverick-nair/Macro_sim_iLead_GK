import { useId, useState } from 'react';
import type { AuthorDraft } from '../../model/draft';
import { useAuthor } from '../../model/store';
import type { Issue } from '../../model/validate';
import { explainIssue, isWalkPage, nextPage, pageHash, pageReview, proposeFix, WALK_PAGES, walkOf, type PageReview, type WalkPage } from '../../model/walkthrough';
import { BUTTON, FOCUS, Icon } from '../kit';
import { navigate } from '../route';
import { labelOf } from '../sections';
import { useWalk, walkStore } from './walk';

const STATE_TEXT: Record<PageReview['state'], string> = {
  confirmed: 'Confirmed',
  changed: 'Changed since you confirmed it',
  blocked: 'To fix before you confirm',
  open: 'Not confirmed yet'
};
export const pageStateText = (r: PageReview) => (r.state === 'blocked' ? `${r.blocking} to fix` : STATE_TEXT[r.state]);

/**
 * One issue as Kora explains it (D244): what is wrong, why it matters, what to do, and, where Kora can make the
 * change safely, the change it proposes. Nothing changes until the author applies it, as one step of undo.
 */
export function KoraIssue({ issue, d, open: startOpen, linked = false, here = false }: { issue: Issue; d: AuthorDraft; open?: boolean; linked?: boolean; here?: boolean }) {
  const edit = useAuthor(s => s.edit);
  const [proposing, setProposing] = useState(false);
  const [note, setNote] = useState('');
  const x = explainIssue(issue, labelOf(issue.tab), here);
  const fix = proposeFix(issue, d);
  return (
    <li className={`flex flex-col gap-2 rounded-14 border border-solid p-3.5 ${issue.blocking ? 'border-author-need-line bg-author-need-field' : 'border-author-line bg-author-surface'}`}>
      <span className="flex flex-wrap items-baseline gap-2">
        <b className="min-w-0 flex-1 text-15">{issue.title}</b>
        <span className={`rounded-round px-2 py-0.5 text-12 font-800 ${issue.blocking ? 'bg-author-need-badge text-author-need' : 'bg-author-track text-author-body'}`}>{issue.blocking ? 'Stops publishing' : 'Advice'}</span>
      </span>
      <details open={startOpen ?? issue.blocking} className="text-14 leading-[1.5]">
        <summary className={`cursor-pointer text-13 font-800 text-author-ai ${FOCUS}`}>Kora explains</summary>
        <dl className="m-0 mt-2 flex flex-col gap-2">
          <div><dt className="text-13 font-800">What is wrong</dt><dd className="m-0">{x.what}</dd></div>
          <div><dt className="text-13 font-800">Why it matters</dt><dd className="m-0">{x.why}</dd></div>
          <div>
            <dt className="text-13 font-800">How to fix it</dt>
            <dd className="m-0"><ol className="m-0 flex list-decimal flex-col gap-1 ps-5">{x.steps.map(s => <li key={s}>{s}</li>)}</ol></dd>
          </div>
        </dl>
      </details>
      {fix && !proposing && <button type="button" className={`${BUTTON.koraOutline} self-start`} onClick={() => setProposing(true)}>{Icon.spark(14)} Kora can fix this</button>}
      {fix && proposing && (
        <section aria-label="Kora's proposed fix" className="flex flex-col gap-2 rounded-12 border border-solid border-author-ai-line-strong bg-author-ai-field p-3">
          <h4 className="m-0 text-14 font-800 text-author-ai">Kora proposes: {fix.label}</h4>
          <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-13">{fix.changes.map(c => <li key={c}>{c}</li>)}</ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON.primary} onClick={() => { edit(fix.apply, { label: `Kora: ${fix.label}`, by: 'ai' }); setProposing(false); setNote(`Applied. Undo puts it back.`); }}>Apply</button>
            <button type="button" className={BUTTON.secondary} onClick={() => { setProposing(false); setNote('Discarded. Nothing changed.'); }}>Discard</button>
          </div>
        </section>
      )}
      {linked && <button type="button" className={`${BUTTON.link} self-start text-13`} onClick={() => (isWalkPage(issue.tab) ? openPage(issue.tab) : navigate({ page: 'workspace', tab: issue.tab }))}>Open {labelOf(issue.tab)}</button>}
      <p role="status" className="m-0 text-13 text-author-body empty:hidden">{note}</p>
    </li>
  );
}

/** Opens a page in the walkthrough. */
export function openPage(page: WalkPage) {
  walkStore.getState().set(true);
  navigate({ page: 'workspace', tab: page });
}

/**
 * Kora's check of the page, over the page while the author walks through publishing (D244): where they are in the
 * walk, every issue on this page explained, and Confirm. A page with something that stops publishing cannot be
 * confirmed until it is fixed; advice never stops it.
 */
export function WalkPanel({ page }: { page: WalkPage }) {
  const d = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const stop = useWalk(s => s.set);
  const reasonId = useId();
  const r = pageReview(d, page);
  const walk = walkOf(d);
  const n = WALK_PAGES.indexOf(page) + 1;
  const after = nextPage(page);
  const confirm = () => {
    edit(x => { x.publish.reviewed[page] = pageHash(x, page); }, { history: false });
    navigate({ page: 'workspace', tab: after ?? 'publish' });
  };
  const said = r.issues.length === 0
    ? 'Kora checked this page: nothing here stops the simulation from running. Read it through, then confirm it.'
    : r.blocking
      ? `Kora checked this page: ${r.blocking} ${r.blocking === 1 ? 'thing stops' : 'things stop'} the simulation from being published${r.issues.length > r.blocking ? `, and ${r.issues.length - r.blocking} ${r.issues.length - r.blocking === 1 ? 'piece' : 'pieces'} of advice` : ''}. Each one is explained below.`
      : `Kora checked this page: nothing stops publishing, and ${r.issues.length} ${r.issues.length === 1 ? 'piece' : 'pieces'} of advice is below.`;
  return (
    <section aria-label="Publishing walkthrough" data-walk="" className="mx-7 mt-4 flex max-h-[45vh] flex-none flex-col gap-3 overflow-auto rounded-16 border border-solid border-author-kora bg-author-surface p-4 max-[1100px]:mx-5">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-round bg-author-kora text-15 font-800 text-author-on-primary">K</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-15">Publishing walkthrough &middot; page {n} of {WALK_PAGES.length}: {labelOf(page)}</b>
          <span className="text-13 text-author-body">{walk.confirmed} of {WALK_PAGES.length} pages confirmed &middot; this page: {pageStateText(r)}</span>
        </span>
        <button type="button" className={BUTTON.secondary} onClick={() => stop(false)}>Leave the walkthrough</button>
      </div>
      <p className="m-0 text-14 leading-[1.5]">{said}</p>
      {r.issues.length > 0 && <ul aria-label="What Kora found on this page" className="m-0 flex list-none flex-col gap-2 p-0">{r.issues.map(i => <KoraIssue key={i.id} issue={i} d={d} here />)}</ul>}
      <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-solid border-author-rule bg-author-surface px-4 py-3">
        {n > 1 && <button type="button" className={BUTTON.secondary} onClick={() => navigate({ page: 'workspace', tab: WALK_PAGES[n - 2] })}>Back</button>}
        <button type="button" className={BUTTON.primary} disabled={r.blocking > 0} aria-describedby={r.blocking ? reasonId : undefined} onClick={confirm}>
          {r.state === 'confirmed' ? 'Still good, continue' : 'Confirm this page'}{after ? ` and go to ${labelOf(after)}` : ' and go to Review and publish'}
        </button>
        {r.blocking > 0 && <span id={reasonId} className="text-13 font-700 text-author-need">Fix what stops publishing first. Kora checks again as you change the page.</span>}
      </div>
    </section>
  );
}
