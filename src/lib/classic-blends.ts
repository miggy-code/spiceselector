import rawData from "@/data/classic-blends.json";

export interface ClassicBlend {
  id: string;
  name: string;
  origin: string;
  description: string;
  spiceIds: string[];
}

export interface BlendMatch {
  blend: ClassicBlend;
  matchedIds: string[];
  missingIds: string[];
  fraction: number;
}

export const allClassicBlends: ClassicBlend[] = rawData as ClassicBlend[];

/**
 * Given a set of selected taxonomy dot-ids, return the classic blends that
 * best match — sorted by fraction (matched / blend size) descending.
 *
 * Only blends with ≥ 2 matched spices AND fraction ≥ 1/3 are returned.
 */
export function matchClassicBlends(selectedIds: string[]): BlendMatch[] {
  const selectedSet = new Set(selectedIds);
  const matches: BlendMatch[] = [];

  for (const blend of allClassicBlends) {
    const matchedIds = blend.spiceIds.filter((id) => selectedSet.has(id));
    const missingIds = blend.spiceIds.filter((id) => !selectedSet.has(id));
    const fraction = matchedIds.length / blend.spiceIds.length;

    if (matchedIds.length >= 2 && fraction >= 1 / 3) {
      matches.push({ blend, matchedIds, missingIds, fraction });
    }
  }

  return matches.sort((a, b) => b.fraction - a.fraction);
}
