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

/** Normalize generated family labels to the app's eight canonical families. */
export function normalizeFamily(family: string): string {
  const key = family.trim().toLowerCase().replace(/[\s_]+/g, '-');
  const aliases: Record<string, string> = {
    'ginger-family': 'earthy',
    'chili-pepper': 'hot-pungent',
    nutty: 'umami-savory',
  };
  return aliases[key] ?? key;
}

export function getFamilyColor(family: string): string {
  return FAMILY_COLORS[normalizeFamily(family)] ?? '#90caf9';
}

export function familyLabel(family: string): string {
  const label = normalizeFamily(family).replace('hot-pungent', 'hot & pungent').replace('citrus-bright', 'citrus & bright').replace('umami-savory', 'umami & savory');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
