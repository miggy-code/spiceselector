/** Design tokens for code that can't use CSS classes (SVG attributes, three.js). Mirrors globals.css. */
export const THEME = {
  board: '#24282c',
  boardRaised: '#2d3237',
  boardHigh: '#383e44',
  boardDeep: '#1d2024',
  chalk: '#f3efe8',
  chalk2: '#d6d1c8',
  chalk3: '#aca79e',
  rule: 'rgba(243,239,232,0.13)',
} as const;

/** Shared motion timings (ms) so every transition feels like one system. */
export const MOTION = {
  quick: 160,
  settle: 420,
  travel: 700,
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;
