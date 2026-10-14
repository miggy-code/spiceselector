"use client";

import type { RankedPairing } from "@/lib/pairing-engine";
import { spiceName } from "@/lib/spice-list";
import { Meter } from "./ui";

const traditionSentence: Record<string, string> = {
  classic: "A classic pairing in at least one cuisine.",
  complementary: "Complementary: different characters that support each other.",
  surprising: "Surprising: uncommon, but it works.",
};

/** Kept for existing callers: a chalk meter for a 0–1 score. */
export function ScoreBar({ score }: { score: number }) {
  return <Meter value={score} className="flex-1" />;
}

/**
 * The three kinds of evidence behind a suggestion, shown side by side rather
 * than folded into one number. Rendered inline under the suggestion so it is
 * never clipped by the panel's scroll area.
 */
export default function WhyDetails({ pairing }: { pairing: RankedPairing }) {
  const overlap = pairing.compoundOverlap;
  const words = overlap?.flavordb2?.sharedFlavorWords ?? [];

  return (
    <div className="rise-in mt-1 pr-1">
      <p className="text-small text-chalk-3">
        Overall {pairing.blendedScore.toFixed(2)}, from three independent kinds of evidence.
      </p>

      <div className="mt-3">
        <p className="text-body font-medium text-chalk">Recipes</p>
        {pairing.affinityDetails.length > 0 ? (
          <>
            <div className="mt-1.5 grid gap-1.5">
              {pairing.affinityDetails.map((d) => (
                <div key={d.spiceId} className="grid grid-cols-[minmax(0,118px)_1fr_32px] items-center gap-2">
                  <span className="text-small leading-tight text-chalk-2">with {spiceName(d.spiceId)}</span>
                  <Meter value={d.score} />
                  <span className="text-right text-small text-chalk-2">{d.score.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-micro text-chalk-3">How closely they travel together across about a million recipes.</p>
          </>
        ) : (
          <p className="mt-1 text-small text-chalk-3">No recipe data for this pair.</p>
        )}
      </div>

      <div className="mt-3 border-t border-rule pt-3">
        <p className="text-body font-medium text-chalk">Chemistry</p>
        {overlap ? (
          <>
            <div className="mt-1.5 grid grid-cols-[minmax(0,118px)_1fr_32px] items-center gap-2">
              <span className="text-small text-chalk-2">shared aroma</span>
              <Meter value={overlap.compoundScore} />
              <span className="text-right text-small text-chalk-2">{overlap.compoundScore.toFixed(2)}</span>
            </div>
            {words.length > 0 && (
              <p className="mt-2 text-small leading-snug text-chalk-2">Both carry {formatList(words.slice(0, 6))} notes.</p>
            )}
            {overlap.sharedAromaCount > 0 && (
              <p className="mt-1 text-small leading-snug text-chalk-3">
                {overlap.sharedAromaCount} shared aroma compound{overlap.sharedAromaCount !== 1 ? "s" : ""}
                {overlap.shared.length > 0 ? `, including ${formatList(overlap.shared.slice(0, 3).map((c) => c.name))}` : ""}.
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-small text-chalk-3">No chemistry data for this pair.</p>
        )}
      </div>

      <div className="mt-3 border-t border-rule pt-3">
        <p className="text-body font-medium text-chalk">Tradition</p>
        <p className="mt-1 text-small leading-snug text-chalk-2">
          {traditionSentence[pairing.affinity]}
          {pairing.note ? ` ${pairing.note}` : ""}
        </p>
      </div>
    </div>
  );
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
