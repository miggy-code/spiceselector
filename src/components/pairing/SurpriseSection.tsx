'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { pickSurprise, type SurprisePairing } from '@/lib/surprise-finder';
import { Section, Swatch, Meter, SmallButton } from './ui';

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Human explanation of *why* this pairing counts as surprising. */
function noveltyFacts(s: SurprisePairing): string[] {
  const facts: string[] = [];
  if (s.taxonomyFamiliarity === 0) {
    facts.push('they come from different flavor families');
  }
  if (
    !s.compoundOverlap ||
    (s.compoundOverlap.sharedAromaCount === 0 && !s.compoundOverlap.flavordb2)
  ) {
    facts.push('they share almost no flavor chemistry');
  } else if (
    s.compoundOverlap.sharedAromaCount > 0 &&
    s.compoundOverlap.sharedAromaCount <= 3
  ) {
    facts.push(
      `they share only ${s.compoundOverlap.sharedAromaCount} aroma compound${
        s.compoundOverlap.sharedAromaCount !== 1 ? 's' : ''
      }`
    );
  }
  if (!s.curatedLabel) {
    facts.push('no cookbook pairing lists them together');
  }
  return facts;
}

/**
 * The flavor notes the pair's few shared compounds carry — friendlier than
 * raw IUPAC compound names in a card meant to be fun.
 */
function sharedFlavorWords(s: SurprisePairing): string[] {
  if (!s.compoundOverlap) return [];
  const words = new Set<string>();
  for (const c of s.compoundOverlap.shared) {
    for (const f of c.flavors) words.add(f);
  }
  for (const f of s.compoundOverlap.flavordb2?.sharedFlavorWords ?? []) words.add(f);
  return Array.from(words).slice(0, 5);
}

interface SurpriseSectionProps {
  /** taxonomy dot-id → map slug, for putting the pair on the map. */
  tidToSlug: Map<string, string>;
  /** Current selection in taxonomy-id space; a single spice scopes the roll. */
  selectedTaxonomyIds: Set<string>;
}

/**
 * "Surprise me": rolls a high-affinity, low-familiarity
 * pairing from the surprise engine. With exactly one spice selected the roll
 * is scoped to that spice; otherwise it samples the global pool.
 */
export default function SurpriseSection({ tidToSlug, selectedTaxonomyIds }: SurpriseSectionProps) {
  const { selectSpices } = useSelection();
  const [surprise, setSurprise] = useState<SurprisePairing | null>(null);
  // Bumped on every roll so framer-motion re-animates the card.
  const [rollCount, setRollCount] = useState(0);

  const roll = useCallback(() => {
    const forSpiceId =
      selectedTaxonomyIds.size === 1 ? Array.from(selectedTaxonomyIds)[0] : undefined;
    let next: SurprisePairing | null = null;
    // Re-sample a few times so consecutive rolls feel fresh.
    for (let i = 0; i < 6; i++) {
      next = pickSurprise({ forSpiceId });
      if (!next) break;
      if (!surprise || next.a !== surprise.a || next.b !== surprise.b) break;
    }
    setSurprise(next);
    setRollCount((c) => c + 1);
  }, [selectedTaxonomyIds, surprise]);

  const slugA = surprise ? tidToSlug.get(surprise.a) : undefined;
  const slugB = surprise ? tidToSlug.get(surprise.b) : undefined;
  const canTry = !!(slugA && slugB);
  const sharedWords = surprise ? sharedFlavorWords(surprise) : [];

  return (
    <Section
      title="Surprise me"
      description={
        !surprise
          ? selectedTaxonomyIds.size === 1
            ? 'An unexpected partner for the spice you picked.'
            : 'A pairing that works in real recipes, though few cookbooks will tell you about it.'
          : undefined
      }
      aside={
        <div className="flex items-center gap-1.5">
          <SmallButton onClick={roll} pressed={!surprise}>
            {surprise ? 'Roll again' : 'Roll a pairing'}
          </SmallButton>
          {surprise && (
            <SmallButton onClick={() => setSurprise(null)} aria-label="Dismiss this pairing">
              Clear
            </SmallButton>
          )}
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {surprise && (
          <motion.div
            key={`${surprise.a}×${surprise.b}×${rollCount}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-2">
                <Swatch tid={surprise.a} size={24} />
                <span className="font-display text-lead text-chalk">{surprise.aName}</span>
              </span>
              <span className="flex items-center gap-2">
                <Swatch tid={surprise.b} size={24} />
                <span className="font-display text-lead text-chalk">{surprise.bName}</span>
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="w-14 text-small text-chalk-3">Recipes</span>
              <Meter value={surprise.affinity} className="flex-1" />
              <span className="w-8 text-right text-small text-chalk-2">{surprise.affinity.toFixed(2)}</span>
            </div>

            <p className="mt-2.5 text-small leading-relaxed text-chalk-2">
              Real recipes pair these often, yet {noveltyFacts(surprise).join(', ')}.
              {sharedWords.length > 0 && ` Both carry ${formatList(sharedWords)} notes.`}
            </p>

            <div className="mt-3 flex items-center justify-end gap-2">
              {canTry ? (
                <SmallButton onClick={() => selectSpices([slugA!, slugB!])} pressed>
                  Try it on the map
                </SmallButton>
              ) : (
                <span className="text-small text-chalk-3" title="One of these spices isn't plotted on this map">
                  Not fully on this map
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
