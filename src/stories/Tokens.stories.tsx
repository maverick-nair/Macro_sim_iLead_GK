import type { Meta, StoryObj } from '@storybook/react-vite';
import { tokens } from '../styles/tokens.generated';

/** Live view of the generated token layers. Switch the Theme toolbar to see light, dark and client values. */
const meta: Meta = { title: 'Foundations/Tokens' };
export default meta;

const v = (path: string) => `var(--il-${path.replace(/\./g, '-')})`;
const label = { fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--il-color-fg-secondary)' } as const;

function Swatch({ path }: { path: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 40, height: 40, borderRadius: 8, background: v(path), border: `1px solid ${v('color.line.default')}`, flex: 'none' }} />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <code style={{ fontSize: 13 }}>{path}</code>
        <span style={label}>{v(path)}</span>
      </span>
    </div>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 } as const;

export const SemanticColors: StoryObj = {
  render: () => <div style={grid}>{tokens.semantic.filter(p => p.startsWith('color.') || p.startsWith('fill.')).map(p => <Swatch key={p} path={p} />)}</div>
};

export const PrimitiveColors: StoryObj = {
  render: () => <div style={grid}>{Object.keys(tokens.primitive).filter(p => p.startsWith('color.') || p.startsWith('gradient.')).map(p => <Swatch key={p} path={p} />)}</div>
};

export const TypeScale: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.keys(tokens.primitive).filter(p => p.startsWith('font.size.')).map(p => (
        <div key={p} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <code style={{ ...label, width: 120, flex: 'none' }}>{p}</code>
          <span style={{ fontSize: v(p), fontWeight: 700, lineHeight: 1.2 }}>Lead your team</span>
        </div>
      ))}
    </div>
  )
};

export const Radii: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {Object.keys(tokens.primitive).filter(p => p.startsWith('radius.')).map(p => (
        <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: v(p), background: v('color.surface.raised'), border: `1px solid ${v('color.line.strong')}` }} />
          <code style={label}>{p}</code>
        </div>
      ))}
    </div>
  )
};
