import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { STYLE_KEYS, StyleControl, StyleRadio, StyleTooltip, type StyleControlProps } from './StyleControl';

const meta: Meta = { title: 'Components/Style control' };
export default meta;

const Frame = ({ width, children }: { width: number; children: ReactNode }) => <div style={{ width, paddingTop: 80 }}>{children}</div>;

function Live(p: Partial<StyleControlProps>) {
  const [value, setValue] = useState<StyleKey>(p.value ?? 'D');
  return <StyleControl memberName="Kent Goldberg" {...p} value={value} onChange={setValue} />;
}

/** Hover or focus a letter for the full name and meaning. Tab into the group, arrow keys move between letters, Enter or Space picks. */
export const Card: StoryObj = { render: () => <Frame width={206}><Live /></Frame> };

/** The roomier control on the style setting screen. */
export const StyleSetting: StoryObj = { render: () => <Frame width={240}><Live size="md" value="P" /></Frame> };

/** Locked for the period: dimmed and aria-disabled, the reason is each letter's description. Clicks and Enter change nothing; tooltips still show. */
export const Disabled: StoryObj = { render: () => <Frame width={206}><Live value="G" disabled disabledReason="Styles are set until the next week." /></Frame> };

export const EverySelection: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 206 }}>
      {STYLE_KEYS.map(k => <StyleControl key={k} value={k} onChange={() => {}} memberName="Kent Goldberg" />)}
    </div>
  )
};

/** Tooltips on the first two letters line up with the left edge, on the last two with the right edge. */
export const TooltipEachLetter: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 260px)', gap: '8px 24px' }}>
      {STYLE_KEYS.map(k => <Frame key={k} width={206}><StyleControl value="D" onChange={() => {}} memberName="Kent Goldberg" tooltip={k} onTooltipChange={() => {}} /></Frame>)}
    </div>
  )
};

export const TooltipStyleSetting: StoryObj = {
  render: () => <Frame width={240}><StyleControl size="md" value="P" onChange={() => {}} memberName="Kent Goldberg" tooltip="P" onTooltipChange={() => {}} /></Frame>
};

/** Keyboard focus on the selected letter: focus ring plus its tooltip. */
function Focused() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ focusVisible: true } as FocusOptions); }, []);
  return <div ref={ref}><Frame width={206}><Live value="G" /></Frame></div>;
}
export const KeyboardFocus: StoryObj = { render: () => <Focused /> };

export const Tooltips: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      {(['sm', 'md'] as const).map(size => <div key={size} style={{ position: 'relative', width: 60, height: 120 }}><div style={{ position: 'absolute', bottom: 0, width: 60 }}><StyleTooltip style="G" align="start" size={size} /></div></div>)}
    </div>
  )
};

/** List view of the style setting screen: one native radio per style, arrow keys move within a member's row. */
function ListRow() {
  const [value, setValue] = useState<StyleKey>('D');
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 96px)', gap: 12 }}>{STYLE_KEYS.map(k => <StyleRadio key={k} style={k} memberName="Kent Goldberg" name="st-kent" checked={value === k} onSelect={setValue} />)}</div>;
}
export const ListRadios: StoryObj = { render: () => <ListRow /> };
