'use client';

import { useState } from 'react';
import { useSelection } from '@/context/SelectionContext';
import { useSavedBlends } from '@/context/SavedBlendsContext';
import { encodeBlendUrl } from '@/lib/blend-url';
import { FAMILY_COLORS } from '@/lib/colors';

interface SavedBlendsListProps {
  /** slug → family, for the color dots (also validates slugs still exist). */
  slugFamilies: Map<string, string>;
}

/** The user's saved blends — one click puts a blend back on the map. */
export default function SavedBlendsList({ slugFamilies }: SavedBlendsListProps) {
  const { blends, deleteBlend } = useSavedBlends();
  const { selectSpices } = useSelection();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (blends.length === 0) return null;

  async function share(id: string, name: string, slugs: string[]) {
    try {
      await navigator.clipboard.writeText(encodeBlendUrl(slugs, name));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
        Your blends · {blends.length}
      </p>
      <ul className="space-y-1.5">
        {blends.map((b) => {
          const validSlugs = b.slugs.filter((s) => slugFamilies.has(s));
          return (
            <li
              key={b.id}
              className="group rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-400/25 p-2.5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectSpices(validSlugs)}
                  className="flex-1 min-w-0 text-left"
                  title="Load onto the map"
                >
                  <span className="text-[13px] font-medium text-white/90 block truncate">
                    {b.name}
                  </span>
                  <span className="flex items-center gap-1 mt-1">
                    {validSlugs.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: FAMILY_COLORS[slugFamilies.get(s)!] ?? '#888' }}
                      />
                    ))}
                    <span className="text-[10px] text-white/35 ml-1">
                      {validSlugs.length} spices
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => share(b.id, b.name, validSlugs)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/50 hover:text-white/90 hover:border-white/30 transition-all flex-shrink-0"
                >
                  {copiedId === b.id ? 'copied ✓' : '⤴ share'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteBlend(b.id)}
                  aria-label={`Delete ${b.name}`}
                  className="text-white/20 hover:text-red-400 text-[13px] leading-none px-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
