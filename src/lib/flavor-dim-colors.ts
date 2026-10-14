export type FlavorDimension = 'warmth' | 'brightness' | 'earthiness' | 'florality' | 'heat';

/** Stable accent colors keep the flavor dimensions distinct across every view. */
export const FLAVOR_DIM_COLORS: Record<FlavorDimension, string> = {
  warmth: '#e5ad62',
  brightness: '#75c1df',
  earthiness: '#a9bf77',
  florality: '#c39cde',
  heat: '#ef7968',
};
