import { useState, type CSSProperties, type ReactNode } from 'react';

/** Genie design system Button, ported from GenieKreatorGuidelines `components/forms/Button.jsx`. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const sizes: Record<ButtonSize, CSSProperties> = {
  sm: { height: 32, padding: '0 14px', fontSize: 13 },
  md: { height: 40, padding: '0 20px', fontSize: 14 },
  lg: { height: 48, padding: '0 26px', fontSize: 15 }
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--grad-brand)', color: '#0A081B', border: 'none' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text-body)', border: '1px solid var(--surface-border-strong)' },
  ghost: { background: 'transparent', color: 'var(--electric-blue)', border: 'none' }
};

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  'aria-label'?: string;
}

export function Button({ variant = 'primary', size = 'md', disabled = false, children, onClick, style, ...rest }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const v = variants[variant] ?? variants.primary;
  return (
    <button
      type="button"
      aria-label={rest['aria-label']}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sizes[size],
        ...v,
        fontFamily: 'var(--font-sans)',
        fontWeight: 700,
        borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'filter .15s var(--ease-brand),background .15s',
        filter: hover && !disabled ? 'brightness(1.15)' : 'none',
        ...(variant === 'ghost' && hover && !disabled ? { color: 'var(--cyber-cyan)' } : null),
        ...style
      }}
    >
      {children}
    </button>
  );
}

/**
 * The designs always mount Button inside
 * `<span style="display:inline-flex; flex:none; white-space:nowrap">` so labels never wrap.
 * This is that wrapper.
 */
export function NoWrapButton(props: ButtonProps) {
  return (
    <span style={{ display: 'inline-flex', flex: 'none', whiteSpace: 'nowrap' }}>
      <Button {...props} />
    </span>
  );
}
