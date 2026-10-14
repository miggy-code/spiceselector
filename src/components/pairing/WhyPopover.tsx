"use client";

import type { RankedPairing } from "@/lib/pairing-engine";
import { spiceName } from "@/lib/spice-list";
import { Meter, AFFINITY_WORDS } from "./ui";

/** Kept for existing callers: a chalk meter for a 0–1 score. */
export function ScoreBar({ score }: { score: number }) {
  return <Meter value={score} className="flex-1" />;
}

const ROW = "grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2";

/**
 * The three kinds of evidence behind a suggestion, in three tight lines.
 * Rendered inline under the row so it is never clipped by the scroll area.
 */
export default function WhyDetails({ pairing }: { pairing: RankedPairing }) {
  const overlap = pairing.compoundOverlap;
  const words = Array.from(
    new Set([
      ...(overlap?.flavordb2?.sharedFlavorWords ?? []),
      ...(overlap?.shared.flatMap((c) => c.flavors) ?? []),
    ])
  ).slice(0, 4);
  const details = pairing.affinityDetails;

  return (
    <div className="rise-in grid gap-1.5 pr-1 text-small">
      {details.length === 0 ? (
        <div className={ROW}>
          <span className="text-chalk-2" title="How often they meet in about a million recipes (FlavorGraph)">Recipes</span>
          <span className="col-span-2 text-chalk-3">no data</span>
        </div>
      ) : details.length === 1 ? (
        <div className={ROW}>
          <span className="text-chalk-2" title="How often they meet in about a million recipes (FlavorGraph)">Recipes</span>
          <Meter value={details[0].score} />
          <span className="text-right text-chalk-2">{details[0].score.toFixed(2)}</span>
        </div>
      ) : (
        <div className="grid gap-1">
          <span className="text-chalk-2" title="How often they meet in about a million recipes (FlavorGraph)">Recipes</span>
          {details.map((d) => (
            <div key={d.spiceId} className={ROW}>
              <span className="truncate pl-2 text-chalk-3">{spiceName(d.spiceId)}</span>
              <Meter value={d.score} />
              <span className="text-right text-chalk-2">{d.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className={ROW}>
          <span className="text-chalk-2" title="Shared aroma molecules (FlavorDB2, FooDB, USDA)">Chemistry</span>
          {overlap ? (
            <>
              <Meter value={overlap.compoundScore} />
              <span className="text-right text-chalk-2">{overlap.compoundScore.toFixed(2)}</span>
            </>
          ) : (
            <span className="col-span-2 text-chalk-3">no data</span>
          )}
        </div>
        {words.length > 0 && <p className="mt-0.5 pl-[calc(4.5rem+0.5rem)] text-micro text-chalk-3">{words.join(", ")}</p>}
      </div>

      <div className="flex items-baseline gap-2" title="Curated cookbook label">
        <span className="w-[4.5rem] shrink-0 text-chalk-2">Tradition</span>
        <span className="min-w-0 text-chalk-2">
          <span className="text-chalk">{AFFINITY_WORDS[pairing.affinity]}</span>
          {pairing.note ? `. ${pairing.note}` : ""}
        </span>
      </div>
    </div>
  );
}
