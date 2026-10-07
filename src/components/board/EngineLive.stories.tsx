import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import type { EngineClient } from '../../engine/client';
import type { StorylineConfig } from '../../engine/config';
import { createMockClient, defaultStoryline } from '../../engine/mock';
import { EngineProvider, useEngineView } from '../../engine/react';
import { MoneyProvider } from '../../i18n/money';
import { EngineLive } from './EngineLive';

/**
 * The live screen on the in-browser mock engine, one story per format the engine can open. Each
 * story confirms styles, then opens the interaction with the same intents the board sends, so the
 * NPC's opening line streams in as it does in the app. Ending is a no op here (the board owns the
 * reacting beat and the outcome).
 */
const meta: Meta = { title: 'Board/Engine live', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};
type Setup = (client: EngineClient) => Promise<unknown>;

async function confirmStyles(client: EngineClient) {
  const v = await client.view();
  if (v.phase === 'style') await client.send({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G' as const])) });
}
const plan = (action: string, option: string, memberIds: string[]): Setup => async client => {
  await confirmStyles(client);
  await client.send({ type: 'planAction', action, option, memberIds });
};

function Live() {
  const q = useEngineView();
  if (!q.data?.live) return null;
  return (
    <MoneyProvider money={q.data.money}>
      <div style={{ minHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
        <EngineLive view={q.data} live={q.data.live} voiceConsent={false} input="text" onFinish={async () => true} onDone={noop} onError={noop} />
      </div>
    </MoneyProvider>
  );
}

/** Opens the interaction on its own mock client before the screen mounts. */
function Harness({ setup, config, startPeriod }: { setup: Setup; config?: StorylineConfig; startPeriod?: number }) {
  const [state] = useState(() => {
    const client = createMockClient({ seed: 1, config, startPeriod });
    return { client, ready: setup(client) };
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void state.ready.then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [state]);
  return ready ? <EngineProvider client={state.client}><Live /></EngineProvider> : null;
}

/** 1:1 RolePlay: Meet face to face with Kent. */
export const RolePlay: StoryObj = { render: () => <Harness setup={plan('f2f', 'guiding', ['kent'])} /> };

/** Coaching is a 1:1 too; the header names the action. */
export const Coaching: StoryObj = { render: () => <Harness setup={plan('coach', 'directing', ['peter'])} /> };

/** Email, written once. */
export const Email: StoryObj = { render: () => <Harness setup={plan('email', 'congratulatory', ['beth'])} /> };

/** Team meeting with everyone. */
export const Meeting: StoryObj = { render: () => <Harness setup={plan('meet', 'partnering', [])} /> };

/** Feedback as a chat thread. */
export const Chat: StoryObj = { render: () => <Harness setup={plan('feedback', 'partnering', ['justin'])} /> };

/** Set goals as a written plan. */
export const WrittenPlan: StoryObj = { render: () => <Harness setup={plan('goals', 'guiding', ['derick'])} /> };

/** Hiring interviews, with room in every stage from week 1. */
export const Interview: StoryObj = {
  render: () => {
    const base = defaultStoryline();
    const config = { ...base, maxPerStage: 3, actions: base.actions.map(a => (a.key === 'hire' ? { ...a, unlockPeriod: 1 } : a)) };
    return <Harness config={config} setup={plan('hire', 'interview', [])} />;
  }
};

/** The written plan after Submit (D85): the plan read only beside the check in; End evaluates the fields. */
export const WrittenPlanSubmitted: StoryObj = {
  render: () => (
    <Harness setup={async client => {
      await plan('goals', 'guiding', ['derick'])(client);
      const v = await client.view();
      if (v.live) await client.send({ type: 'submitPlan', interactionId: v.live.id, text: 'Goals: Qualify 12 leads from the Ashcroft list\nMeasures: 12 qualified leads in the CRM\nOwner: Derick',
        plan: { goals: 'Qualify 12 leads from the Ashcroft list', measures: '12 qualified leads in the CRM', owner: 'Derick', due: 5, support: 'I review the list with you on Thursday' } });
    }} />
  )
};

/** The Week 0 practice (D16, D84): before week 1's styles, not scored. */
export const Practice: StoryObj = { render: () => <Harness setup={client => client.send({ type: 'startPractice' })} /> };

/** The week 4 sponsor briefing, opened from the inbox. */
export const SponsorBriefing: StoryObj = {
  render: () => (
    <Harness startPeriod={4} setup={async client => {
      await confirmStyles(client);
      const v = await client.view();
      const briefing = v.inbox.find(x => x.briefing);
      if (briefing) await client.send({ type: 'openConversation', kind: 'sponsor', messageId: briefing.id });
    }} />
  )
};
