import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Genie design system Switch, ported from GenieKreatorGuidelines `components/forms/Switch.jsx`.
 * A native button with role switch: Tab reaches it, Space and Enter toggle it, aria-checked carries
 * the state and the label is its accessible name. Every button default is reset, so it renders as
 * the design's label did.
 */
export interface SwitchProps {
  label?: ReactNode;
  checked?: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export function Switch({ label, checked, onChange, disabled = false, style }: SwitchProps) {
  const [internal, setInternal] = useState(false);
  const on = checked !== undefined ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInternal(!on);
    onChange?.(!on);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={toggle}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        margin: 0,
        padding: 0,
        border: 0,
        background: 'transparent',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        font: 'var(--il-font-weight-400) var(--il-font-size-15)/1.65 var(--il-font-family-sans)',
        color: 'var(--il-color-fg-primary)',
        userSelect: 'none',
        ...style
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 22,
          flex: 'none',
          borderRadius: 999,
          padding: 2,
          boxSizing: 'border-box',
          background: on ? 'var(--il-switch-track-on)' : 'var(--il-switch-track-off)',
          display: 'inline-flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          transition: 'background .2s var(--il-easing-brand)'
        }}
      >
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: on ? 'var(--il-switch-thumb-on)' : 'var(--il-switch-thumb-off)', transition: 'background .2s' }} />
      </span>
      {label}
    </button>
  );
}
