'use client';

import { useState } from 'react';
import { useSelection } from '@/context/SelectionContext';
import { useSavedBlends } from '@/context/SavedBlendsContext';
import { encodeBlendUrl } from '@/lib/blend-url';
import { spiceColor } from '@/lib/spice-colors';
import { Section, Swatch, SmallButton } from './ui';

interface SavedBlendsListProps {
  /** slug → family, for the spice colors (also validates slugs still exist). */
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
    <Section
      title="Saved blends"
      aside={<span className="text-small text-chalk-3">{blends.length}</span>}
    >
      <ul className="divide-y divide-rule">
        {blends.map((b) => {
          const validSlugs = b.slugs.filter((s) => slugFamilies.has(s));
          return (
            <li key={b.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <span className="block truncate font-display text-lead leading-tight text-chalk">{b.name}</span>
                <span className="mt-1 flex items-center gap-1">
                  {validSlugs.slice(0, 8).map((s) => (
                    <Swatch key={s} color={spiceColor(s, undefined, slugFamilies.get(s))} size={12} />
                  ))}
                </span>
              </div>
              <SmallButton onClick={() => selectSpices(validSlugs)} title="Put this blend back on the map">
                Load
              </SmallButton>
              <SmallButton onClick={() => share(b.id, b.name, validSlugs)}>
                {copiedId === b.id ? 'Copied' : 'Share'}
              </SmallButton>
              <SmallButton onClick={() => deleteBlend(b.id)} aria-label={`Delete ${b.name}`}>
                Delete
              </SmallButton>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
