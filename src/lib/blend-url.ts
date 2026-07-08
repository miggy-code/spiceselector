/**
 * Shareable blend links: the whole blend lives in the URL, no backend.
 * Format: /?b=cinnamon~cumin~cardamom&n=Morning%20Chai
 * Slugs are the map's spice ids ([a-z-]), joined with '~'.
 */

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export function encodeBlendUrl(slugs: string[], name?: string): string {
  const params = new URLSearchParams();
  params.set("b", slugs.join("~"));
  if (name?.trim()) params.set("n", name.trim());
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?${params.toString()}`;
}

export interface SharedBlend {
  slugs: string[];
  name: string | null;
}

/** Parse a shared blend out of a query string; null when absent/garbage. */
export function parseBlendParam(search: string): SharedBlend | null {
  const params = new URLSearchParams(search);
  const b = params.get("b");
  if (!b) return null;
  const slugs = b
    .split("~")
    .map((s) => s.trim())
    .filter((s) => SLUG_PATTERN.test(s));
  if (slugs.length === 0) return null;
  return { slugs: Array.from(new Set(slugs)), name: params.get("n") };
}
