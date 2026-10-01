import { useState, type CSSProperties, type ReactNode } from 'react';

/** Genie design system Button, ported from GenieKreatorGuidelines `components/forms/Button.jsx`. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const size = (s: ButtonSize): CSSProperties => ({
  height: `var(--il-button-${s}-height)`,
  padding: `0 var(--il-button-${s}-padding-x)`,
  fontSize: `var(--il-button-${s}-font-size)`
});
const sizes: Record<ButtonSize, CSSProperties> = { sm: size('sm'), md: size('md'), lg: size('lg') };

// Button tokens live in tokens/component.json.
const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--il-button-primary-bg)', color: 'var(--il-button-primary-fg)', border: 'none' },
  secondary: { background: 'var(--il-button-secondary-bg)', color: 'var(--il-button-secondary-fg)', border: '1px solid var(--il-button-secondary-border)' },
  ghost: { background: 'transparent', color: 'var(--il-button-ghost-fg)', border: 'none' }
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
        fontFamily: 'var(--il-font-family-sans)',
        fontWeight: 'var(--il-button-font-weight)' as CSSProperties['fontWeight'],
        borderRadius: 'var(--il-button-radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'filter var(--il-duration-fast) var(--il-easing-brand),background var(--il-duration-fast)',
        filter: hover && !disabled ? 'brightness(1.15)' : 'none',
        ...(variant === 'ghost' && hover && !disabled ? { color: 'var(--il-button-ghost-fg-hover)' } : null),
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
