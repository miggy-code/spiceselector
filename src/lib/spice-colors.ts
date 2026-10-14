/**
 * Spice-true colors: each spice is drawn in the color it actually has in the
 * jar (ground or dried form, or its most recognizable form — cardamom pods,
 * saffron threads, mace blades). Keyed by the taxonomy leaf slug (last segment
 * of the taxonomy id), so the map slugs and taxonomy ids resolve to one color.
 *
 * Family stays visible through grouping and position, not hue.
 */
import { toTaxonomyId } from './spice-id-map';
import { normalizeFamily } from './colors';

export const SPICE_COLORS: Record<string, string> = {
  // warm
  cinnamon: '#A0522D',
  nutmeg: '#8B5A3C',
  allspice: '#6E4532',
  mace: '#D9772B',
  clove: '#4A2C22',
  'star-anise': '#7A3B26',
  cardamom: '#9DAF6A',
  cassia: '#8E4A2B',
  // hot-pungent
  'black-pepper': '#3A3431',
  'white-pepper': '#D8CDB4',
  'sichuan-pepper': '#9C3A2E',
  'long-pepper': '#4E4640',
  cayenne: '#D1462F',
  'red-pepper-flakes': '#B8352A',
  chipotle: '#6B2E25',
  gochugaru: '#E0482F',
  aleppo: '#97302A',
  'mustard-seed': '#C9A23A',
  horseradish: '#EDE6D2',
  wasabi: '#A8C27A',
  // sweet
  vanilla: '#3B2A22',
  'tonka-bean': '#4B3326',
  'fennel-seed': '#A8A86A',
  'anise-seed': '#8F8A64',
  fenugreek: '#D6A845',
  mahlab: '#C9AE84',
  // earthy
  turmeric: '#E3A21A',
  ginger: '#D9BE86',
  galangal: '#E4CDB0',
  cumin: '#8A6A3E',
  coriander: '#B79A68',
  caraway: '#5A4632',
  'celery-seed': '#7A6A44',
  'smoked-paprika': '#9E2B20',
  paprika: '#C9372A',
  sumac: '#8E2436',
  // herbal
  oregano: '#6F7A45',
  thyme: '#7D8562',
  rosemary: '#5F7058',
  marjoram: '#8A9668',
  sage: '#9AA48C',
  lemongrass: '#C8CB8A',
  'thai-basil': '#5D5A73',
  'kaffir-lime-leaf': '#3F6B3A',
  shiso: '#7A3E68',
  basil: '#4F7F3E',
  parsley: '#3F7D3A',
  cilantro: '#5C8F43',
  dill: '#6C8C55',
  'bay-leaf': '#7D8A55',
  tarragon: '#62804A',
  // floral
  'rose-water': '#E3A3AE',
  saffron: '#D2381E',
  hibiscus: '#A11D47',
  lavender: '#8A7BB8',
  chamomile: '#E8D27A',
  elderflower: '#EDE3C2',
  // citrus-bright
  'lemon-zest': '#F0D23C',
  'orange-zest': '#EE8A2A',
  'lime-zest': '#9CC13F',
  yuzu: '#E9C640',
  amchur: '#D8C08E',
  tamarind: '#5E3A24',
  'dried-lime': '#5B4430',
  // umami-savory
  garlic: '#EAE0C8',
  'onion-powder': '#DCC69A',
  chive: '#5F9447',
  'dried-mushroom': '#7C5F45',
  'nutritional-yeast': '#E8C450',
  'black-garlic': '#2C2522',
  'sesame-seed': '#E6D7B5',
  'poppy-seed': '#5C6676',
  'nigella-seed': '#26272B',
};

/** Neutral fallbacks per family when a spice has no entry yet. */
const FAMILY_FALLBACK: Record<string, string> = {
  warm: '#8E5A3A',
  'hot-pungent': '#A8392C',
  sweet: '#B59A6A',
  earthy: '#8A6A3E',
  herbal: '#6C8050',
  floral: '#B38AA8',
  'citrus-bright': '#D9B840',
  'umami-savory': '#B8A27E',
};

function leaf(id: string): string {
  return id.split('.').pop() ?? id;
}

/** Color for a taxonomy id like "warm.baking.cinnamon". */
export function spiceColorForTid(tid: string): string {
  return SPICE_COLORS[leaf(tid)] ?? FAMILY_FALLBACK[tid.split('.')[0]] ?? '#9A948A';
}

/** Color for a map profile (slug id + name + family). */
export function spiceColor(slug: string, name?: string, family?: string): string {
  const tid = toTaxonomyId(slug, name);
  if (tid && SPICE_COLORS[leaf(tid)]) return SPICE_COLORS[leaf(tid)];
  if (SPICE_COLORS[slug]) return SPICE_COLORS[slug];
  if (family) return FAMILY_FALLBACK[normalizeFamily(family)] ?? '#9A948A';
  return '#9A948A';
}

/** Relative luminance (0–1) — used to pick a legible rim on dark spices. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
