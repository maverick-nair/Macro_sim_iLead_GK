import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type ReactNode } from 'react';
import type { AuthorDraft, Tab } from '../model/draft';
import { AuthorStoreContext, createAuthorStore } from '../model/store';
import { AuthorApp, AuthorRoot } from './AuthorPage';
import { chatAfter, journeyDraft, readyDraft, workspaceDraft } from './fixtures';
import { Composer } from './journey/Composer';
import { LibraryAdmin } from './library/LibraryAdmin';
import { ActionAdd } from './workspace/ActionAdd';
import { CharacterEditor } from './workspace/CharacterEditor';
import { StakeholderEditor } from './workspace/StakeholderEditor';
import { blankStakeholderOption, newStakeholder } from '../model/stakeholders';

/**
 * /author, GenieKreator's authoring tool (docs/design/genie, D105 to D111): the journey (co-creator chat,
 * voice, lens, first draft ready), every workspace tab, the character editor, Add an action and the
 * library admin page. Light only, as the canvas draws it; every story has its own in memory draft.
 */
const meta: Meta = { title: 'Author', parameters: { layout: 'fullscreen' } };
export default meta;

const Frame = ({ children, height = 900 }: { children: ReactNode; height?: number }) => <div style={{ height, overflow: 'hidden', margin: -24 }}>{children}</div>;
const app = (draft: () => AuthorDraft, route: Parameters<typeof AuthorApp>[0]['route']) => function Story() {
  const store = useMemo(() => createAuthorStore(draft(), null), []);
  return <Frame><AuthorApp store={store} route={route} /></Frame>;
};
const tab = (t: Tab): StoryObj => ({ render: app(workspaceDraft, { page: 'workspace', tab: t }) });

/** 1. Co-creator chat: four answers in, the draft filling in beside them. */
export const ChatStart: StoryObj = { render: app(() => journeyDraft(4), { page: 'journey' }) };
/** 1b. Answer by voice: the answer box after a recording, the transcript to edit before Send. */
export const ChatVoiceTranscript: StoryObj = {
  render: () => (
    <AuthorRoot>
      <div style={{ maxWidth: 820, padding: 24 }}>
        <Composer question="team_size" placeholder="6 to 12" busy={false} error={null} onSend={async () => true} onUpload={() => undefined}
          hint="Type or record your answer. A recording turns into text you can edit before you send." />
      </div>
    </AuthorRoot>
  )
};
/** 2. Kora recommends a lens; the panel previews its styles. */
export const ChatLens: StoryObj = { render: app(() => ({ ...journeyDraft(10), chat: chatAfter(10) }), { page: 'journey' }) };
/** 3. First draft ready: what is done, what needs you. */
export const DraftReady: StoryObj = { render: app(readyDraft, { page: 'journey' }) };

export const Overview = tab('overview');
export const Brief = tab('brief');
export const StoryAndWorld = tab('story');
export const WorkProcess = tab('process');
export const Team = tab('team');
export const LeadershipLens = tab('lens');
export const Actions = tab('actions');
export const Events = tab('events');
export const ScoringAndReport = tab('scoring');
export const BrandAndTheme = tab('brand');
export const TestWithSyntheticPlayers = tab('calibrate');
export const ReviewAndPublish = tab('publish');
/** The workspace at a tablet's width: the sections as a row above the tab, Ask Kora behind its button. */
export const TeamAt834: StoryObj = {
  render: function Story() {
    const store = useMemo(() => createAuthorStore(workspaceDraft(), null), []);
    return <div style={{ width: 834, margin: -24 }}><Frame height={1112}><AuthorApp store={store} route={{ page: 'workspace', tab: 'team' }} /></Frame></div>;
  }
};

/** 4b to 4e. The character editor, every field in four tabs. */
export const CharacterEditorIdentity: StoryObj = {
  render: function Story() {
    const draft = useMemo(workspaceDraft, []);
    const store = useMemo(() => createAuthorStore(draft, null), [draft]);
    const [open, setOpen] = useState(true);
    return (
      <AuthorStoreContext.Provider value={store}>
        <AuthorRoot><CharacterEditor draft={draft} character={draft.team[0]} open={open} onOpenChange={setOpen} onSave={() => setOpen(false)} /></AuthorRoot>
      </AuthorStoreContext.Provider>
    );
  }
};

/** A draft with two stakeholders outside the team (D163): the CFO and a client, the client with a decision. */
function stakeholderDraft(): AuthorDraft {
  const d = workspaceDraft();
  d.stakeholders.push(newStakeholder(d, { role: 'cfo' }));
  const client = newStakeholder(d, { role: 'client' });
  const negotiate = client.interactions.find(x => x.type === 'negotiate')!;
  Object.assign(negotiate, { enabled: true, plays: 'static', options: [blankStakeholderOption('hold', 'Hold the scope'), { ...blankStakeholderOption('trade', 'Trade a date for a feature'), needsTrust: 55, refusal: 'Not until you have shown me the plan.' }] });
  d.stakeholders.push(client);
  return d;
}
/** Team with stakeholders outside the team, under the characters. */
export const TeamWithStakeholders: StoryObj = { render: app(stakeholderDraft, { page: 'workspace', tab: 'team' }) };
/** The stakeholder editor on Interactions: a conversation's consequences and a decision's options. */
export const StakeholderEditorInteractions: StoryObj = {
  render: function Story() {
    const draft = useMemo(stakeholderDraft, []);
    const store = useMemo(() => createAuthorStore(draft, null), [draft]);
    const [open, setOpen] = useState(true);
    return (
      <AuthorStoreContext.Provider value={store}>
        <AuthorRoot><StakeholderEditor draft={draft} stakeholder={draft.stakeholders[1]} open={open} onOpenChange={setOpen} onSave={() => setOpen(false)} initialTab="interactions" /></AuthorRoot>
      </AuthorStoreContext.Provider>
    );
  }
};

/** 6c. Add an action: the library, or describe your own to Kora. */
export const AddAnAction: StoryObj = {
  render: function Story() {
    const store = useMemo(() => createAuthorStore(workspaceDraft(), null), []);
    const [open, setOpen] = useState(true);
    return <AuthorStoreContext.Provider value={store}><AuthorRoot><ActionAdd open={open} onOpenChange={setOpen} onAdded={() => setOpen(false)} /></AuthorRoot></AuthorStoreContext.Provider>;
  }
};

/** Library admin: interaction types and action templates. */
export const LibraryAdminPage: StoryObj = { render: () => <Frame><AuthorRoot><LibraryAdmin /></AuthorRoot></Frame> };
