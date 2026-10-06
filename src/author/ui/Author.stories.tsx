import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Brief, type FrameworkDimension } from '../../api/author';
import type { LensId } from '../../engine/lens';
import { extractFramework } from '../extract';
import { LENS_BY_ID, LENS_LIBRARY } from '../lenses';
import { buildModule } from '../module';
import { questionFor } from '../questions';
import { recommendLens } from '../recommend';
import { draftStoryline, previewOf } from '../storyline';
import { AuthorApp } from './AuthorApp';
import { ChatBubble } from './ChatBubble';
import { ChipReplies } from './ChipReplies';
import { ClientFrameworkTable } from './ClientFrameworkTable';
import { LensCard } from './LensCard';
import { LensPicker } from './LensPicker';
import { PreviewPanel } from './PreviewPanel';
import { SummaryPanel } from './SummaryPanel';

const meta: Meta = { title: 'Author chat' };
export default meta;

const BRIEF = Brief.parse({
  roleLevel: 'First time managers', industry: 'Banking and financial services', challenge: 'Leading through change or transformation', client: 'Acme Bank',
  teamSize: 8, process: ['Leads', 'Qualify', 'Proposal', 'Negotiation', 'Conversion'], duration: 'standard', region: 'india', language: 'English, India', framework: null, tone: 'warm'
});
const FRAMEWORK = `## Customer Obsession\n- Starts every plan with the customer's problem\n- Brings customer stories into team meetings\n\n## Bold Ownership\n- Owns outcomes end to end\n- Raises risks early and offers a fix\n\nLevels: Emerging, Practising, Role model`;
const preview = (primary: LensId, secondary: LensId | null) => previewOf(draftStoryline(BRIEF, buildModule(BRIEF, { primary, secondary, clientDimensions: [] }, false)));
const Frame = ({ children, width = 720 }: { children: React.ReactNode; width?: number }) => <div style={{ maxWidth: width }}>{children}</div>;

/** A question, the author's answer with its Edit link, and a note about an upload. */
export const Bubbles: StoryObj = {
  render: () => (
    <Frame>
      <div className="flex flex-col gap-3">
        <ChatBubble from="assistant">Who are your participants?</ChatBubble>
        <ChatBubble from="author" question="Who are your participants?" onEdit={() => undefined}>First time managers</ChatBubble>
        <ChatBubble from="assistant">I read brief.txt. It covers the client and team size, so I will skip those questions.</ChatBubble>
        <ChatBubble from="author" question="Which client is this for?" editing onEdit={() => undefined}>Acme</ChatBubble>
      </div>
    </Frame>
  )
};

/** Quick replies for the work process, with each process's stages under its name. */
export const Chips: StoryObj = { render: () => <Frame><ChipReplies chips={questionFor('process').chips} onPick={() => undefined} /></Frame> };

/** Duration chips, disabled while the chat thinks. */
export const ChipsDisabled: StoryObj = { render: () => <Frame><ChipReplies chips={questionFor('duration').chips} onPick={() => undefined} disabled /></Frame> };

/** A lens card, picked and recommended. "More detail" shows Based on and the design notes. */
export const LensCardRecommended: StoryObj = { render: () => <Frame><LensCard lens={LENS_BY_ID.readiness_based} n={1} name="s" checked recommended onSelect={() => undefined} /></Frame> };

export const LensCardPlain: StoryObj = { render: () => <Frame><LensCard lens={LENS_LIBRARY[5]} n={6} name="s" checked={false} onSelect={() => undefined} /></Frame> };

function Picker({ disabled }: { disabled?: boolean }) {
  const rec = recommendLens(BRIEF);
  const [primary, setPrimary] = useState<LensId | null>(rec.id);
  const [secondary, setSecondary] = useState<LensId | null>(null);
  return <LensPicker primary={primary} secondary={secondary} recommendation={rec} disabled={disabled} onPrimary={setPrimary} onSecondary={setSecondary} />;
}

/** All eight lenses with the recommendation for a change challenge, the secondary picker and the "Works well with" hint. */
export const Picker8: StoryObj = { name: 'Lens picker', render: () => <Frame><Picker /></Frame> };

/** Locked after the draft: changing the lens goes through the warning. */
export const PickerLocked: StoryObj = { name: 'Lens picker, locked', render: () => <Frame><Picker disabled /></Frame> };

function Table() {
  const [dims, setDims] = useState<FrameworkDimension[]>(() => extractFramework(FRAMEWORK));
  const [ok, setOk] = useState(false);
  return <ClientFrameworkTable dimensions={dims} onChange={d => { setDims(d); setOk(false); }} confirmed={ok} onConfirm={() => setOk(true)} />;
}

/** Dimensions, behaviours and levels read from a pasted framework, ready to edit and confirm. */
export const ClientFramework: StoryObj = { render: () => <Frame width={900}><Table /></Frame> };

/** The build preview for Readiness Based Leadership in a warm tone. */
export const Preview: StoryObj = { render: () => <Frame><PreviewPanel preview={preview('readiness_based', null)} lensTitle="Readiness Based Leadership" /></Frame> };

/** Six Leadership Styles with Inspire and Deliver: the secondary's dimensions are marked Report only. */
export const PreviewWithSecondary: StoryObj = { render: () => <Frame><PreviewPanel preview={preview('six_styles', 'inspire_deliver')} lensTitle="Six Leadership Styles" secondaryTitle="Inspire and Deliver" /></Frame> };

/** "Your simulation so far" part way through the chat. */
export const Summary: StoryObj = {
  render: () => (
    <Frame width={420}>
      <SummaryPanel brief={Brief.parse({ roleLevel: 'Senior leaders', industry: 'Retail and consumer goods', client: null, teamSize: 10 })} inferred={['industry']}
        lens={{ primary: null, secondary: null }} team={null} company={null} dimensions={[]} />
    </Frame>
  )
};

/** The whole chat on the templates, as at /author. */
export const App: StoryObj = { parameters: { layout: 'fullscreen' }, render: () => <AuthorApp /> };
