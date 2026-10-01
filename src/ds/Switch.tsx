import { useState, type CSSProperties, type ReactNode } from 'react';

/** Genie design system Switch, ported from GenieKreatorGuidelines `components/forms/Switch.jsx`. */
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
    <label
      role="switch"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        font: 'var(--type-body)',
        color: 'var(--text-body)',
        userSelect: 'none',
        ...style
      }}
    >
      <span
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          padding: 2,
          boxSizing: 'border-box',
          background: on ? 'var(--grad-brand)' : 'rgba(255,255,255,.12)',
          display: 'inline-flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          transition: 'background .2s var(--ease-brand)'
        }}
      >
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: on ? '#0A081B' : 'var(--pale-lavender)', transition: 'background .2s' }} />
      </span>
      {label}
    </label>
  );
}
