'use client';

/**
 * Shared building blocks for the pairing panel, in the spice-on-slate system:
 * slate surfaces, chalk text and evidence marks, spice-true swatches.
 * No per-section accent colors — sections are separated by space, rules and titles.
 */
import type { ReactNode } from 'react';
import { spiceColorForTid, luminance } from '@/lib/spice-colors';
import { useSelection } from '@/context/SelectionContext';

export function Section({
  title,
  aside,
  description,
  children,
  className = '',
}: {
  title: string;
  aside?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-rule px-5 py-4 ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="font-display text-lead leading-tight text-chalk">{title}</h3>
        {aside}
      </div>
      {description && <div className="-mt-1 mb-3 text-small leading-relaxed text-chalk-2">{description}</div>}
      {children}
    </section>
  );
}

/**
 * A spice drawn in its own color, lit like a small pressed disc of powder:
 * a soft top highlight and a darker lower edge give it body on the slate.
 */
export function Swatch({ tid, color, size = 12, className = '' }: { tid?: string; color?: string; size?: number; className?: string }) {
  const c = color ?? (tid ? spiceColorForTid(tid) : '#9A948A');
  const dark = luminance(c) < 0.05;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: c,
        backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.32), rgba(255,255,255,0) 55%), radial-gradient(circle at 60% 80%, rgba(0,0,0,0.28), rgba(0,0,0,0) 60%)',
        boxShadow: dark
          ? 'inset 0 0 0 1px rgba(243,239,232,0.45), 0 1px 2px rgba(0,0,0,0.4)'
          : 'inset 0 0 0 1px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.35)',
      }}
    />
  );
}

/** A row of overlapping swatches — a blend at a glance. */
export function SwatchStack({ tids, max = 8, size = 14 }: { tids: string[]; max?: number; size?: number }) {
  return (
    <span className="flex items-center" aria-hidden>
      {tids.slice(0, max).map((tid, i) => (
        <span key={tid} className={`rounded-full ring-2 ring-board-raised ${i > 0 ? '-ml-1.5' : ''}`}>
          <Swatch tid={tid} size={size} className="block" />
        </span>
      ))}
    </span>
  );
}

/** Chalk meter for a 0–1 score. Fills smoothly when the value changes. `muted` for weaker evidence. */
export function Meter({ value, muted = false, className = '' }: { value: number; muted?: boolean; className?: string }) {
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full bg-board-high ${className}`}>
      <span
        className={`block h-full origin-left rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${muted ? 'bg-chalk-3/70' : 'bg-chalk'}`}
        style={{ width: `${Math.max(3, Math.round(Math.min(1, Math.max(0, value)) * 100))}%` }}
      />
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  variant?: 'quiet' | 'primary';
  title?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Action button. "quiet" sits on panels without shouting; "primary" (or a
 * pressed toggle) fills with chalk. Every state change is animated.
 */
export function SmallButton({ children, onClick, pressed, variant = 'quiet', title, className = '', ...rest }: ButtonProps) {
  const filled = pressed || variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      className={`inline-flex h-8 select-none items-center gap-1.5 rounded-md px-3 text-small font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] ${
        filled
          ? 'bg-chalk text-board shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_1px_2px_rgba(0,0,0,0.3)] hover:bg-white'
          : 'bg-board-high text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14)] hover:bg-[#424950] hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.26)]'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const AFFINITY_WORDS: Record<string, string> = {
  classic: 'Classic',
  complementary: 'Complementary',
  surprising: 'Surprising',
};

/**
 * Hover sync with the map views: spread `hoverProps(slug)` on a spice row or
 * chip, and read `hoveredSpiceId` to light up rows hovered on the map.
 * Both are map slug ids, not taxonomy ids.
 */
export function useSpiceHover() {
  const { hoveredSpiceId, setHovered } = useSelection();
  const hoverProps = (slug: string | undefined) =>
    slug ? { onMouseEnter: () => setHovered(slug), onMouseLeave: () => setHovered(null) } : {};
  return { hoveredSpiceId, setHovered, hoverProps };
}

/** Round "+" button that adds a spice to the blend. */
export function AddButton({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-board-high text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.16)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-chalk hover:text-board active:scale-90 ${className}`}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
    </button>
  );
}
