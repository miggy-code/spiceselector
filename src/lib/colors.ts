import { hsl } from "d3-color";

export const FAMILY_COLORS: Record<string, string> = {
  warm: "hsl(30, 70%, 50%)",
  "hot-pungent": "hsl(0, 75%, 48%)",
  sweet: "hsl(330, 65%, 55%)",
  earthy: "hsl(25, 40%, 38%)",
  herbal: "hsl(120, 50%, 40%)",
  floral: "hsl(270, 55%, 60%)",
  "citrus-bright": "hsl(55, 80%, 50%)",
  "umami-savory": "hsl(180, 50%, 35%)",
};

/**
 * Derive ring-level color from a family's base color.
 * Inner ring = base, middle = lighter, outer = lightest.
 */
export function ringColor(
  familyId: string,
  level: "family" | "subcategory" | "spice"
): string {
  const base = hsl(FAMILY_COLORS[familyId] ?? "hsl(0, 0%, 50%)");

  switch (level) {
    case "family":
      return base.formatHsl();
    case "subcategory":
      base.s = Math.max(0, base.s - 0.1);
      base.l = Math.min(1, base.l + 0.12);
      return base.formatHsl();
    case "spice":
      base.s = Math.max(0, base.s - 0.2);
      base.l = Math.min(1, base.l + 0.25);
      return base.formatHsl();
  }
}

/**
 * Boosted color for selected arcs.
 */
export function selectedColor(familyId: string): string {
  const base = hsl(FAMILY_COLORS[familyId] ?? "hsl(0, 0%, 50%)");
  base.s = Math.min(1, base.s + 0.15);
  base.l = Math.max(0, base.l - 0.05);
  return base.formatHsl();
}
