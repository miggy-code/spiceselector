'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelection } from '@/context/SelectionContext';
import { useSavedBlends } from '@/context/SavedBlendsContext';
import {
  BLEND_AXES,
  getBlendProfile,
  getBlendCohesion,
  getBlendRatios,
  findBlendGap,
  type BlendAxis,
} from '@/lib/blend-analyzer';
import { encodeBlendUrl } from '@/lib/blend-url';
import { Swatch, Meter, SmallButton, useSpiceHover } from './ui';

const ROLE_WORDS: Record<string, string> = {
  base: 'base',
  support: 'support',
  accent: 'accent',
};

const AXIS_LABELS: Record<BlendAxis, string> = {
  warmth: 'Warm',
  brightness: 'Bright',
  earthiness: 'Earthy',
  florality: 'Floral',
  heat: 'Heat',
};

function cohesionVerdict(score: number): { label: string } {
  if (score >= 0.7) return { label: 'Harmonious' };
  if (score >= 0.55) return { label: 'Balanced' };
  return { label: 'Adventurous' };
}

const RADAR_SIZE = 190;
const RADAR_SCALE = 0.75;
const RADAR_R = 62;
const CX = RADAR_SIZE / 2;
const CY = RADAR_SIZE / 2 + 4;

function radarPoint(axisIndex: number, value01: number): [number, number] {
  // Start at 12 o'clock, go clockwise.
  const angle = -Math.PI / 2 + (axisIndex * 2 * Math.PI) / BLEND_AXES.length;
  return [CX + Math.cos(angle) * RADAR_R * value01, CY + Math.sin(angle) * RADAR_R * value01];
}

function polygonPath(values01: number[]): string {
  return (
    values01
      .map((v, i) => {
        const [x, y] = radarPoint(i, v);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

interface BlendSectionProps {
  /** Selected spices in taxonomy-id space. */
  selectedTids: string[];
  /** taxonomy dot-id → map slug, for adding gap suggestions to the map. */
  tidToSlug: Map<string, string>;
}

/**
 * Blend Builder: the combined flavor shape of the selection (radar), how well
 * it hangs together (cohesion), a starting ratio, and what would balance it.
 */
export default function BlendSection({ selectedTids, tidToSlug }: BlendSectionProps) {
  const { toggleSpice } = useSelection();
  const { hoverProps, setHovered } = useSpiceHover();
  const { saveBlend } = useSavedBlends();
  const [naming, setNaming] = useState(false);
  const [blendName, setBlendName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (selectedTids.length < 2) return null;
    const profile = getBlendProfile(selectedTids);
    if (!profile) return null;
    return {
      profile,
      cohesion: getBlendCohesion(selectedTids),
      gap: findBlendGap(selectedTids),
      ratios: getBlendRatios(selectedTids),
    };
  }, [selectedTids]);

  const selectedSlugs = useMemo(
    () => selectedTids.map((tid) => tidToSlug.get(tid)).filter(Boolean) as string[],
    [selectedTids, tidToSlug]
  );

  function flash(message: string) {
    setFeedback(message);
    setTimeout(() => setFeedback(null), 2000);
  }

  function handleSave() {
    saveBlend(blendName, selectedSlugs);
    setNaming(false);
    setBlendName('');
    flash('Saved');
  }

  async function handleShare() {
    const url = encodeBlendUrl(selectedSlugs, blendName || undefined);
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch {
      flash(url); // clipboard blocked — at least show the link
    }
  }

  if (!analysis) return null;
  const { profile, cohesion, gap, ratios } = analysis;
  const values01 = BLEND_AXES.map((a) => profile.axes[a] / 100);
  const verdict = cohesion ? cohesionVerdict(cohesion.score) : null;

  return (
    <section className="px-5 py-4" aria-label="Your blend">
      <div className="flex items-center gap-3">
        {/* Radar */}
        <svg
          width={RADAR_SIZE * RADAR_SCALE}
          height={RADAR_SIZE * RADAR_SCALE}
          viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
          className="shrink-0"
          role="img"
          aria-label="Blend flavor profile radar"
        >
          {/* Grid rings */}
          {[0.33, 0.66, 1].map((r) => (
            <path
              key={r}
              d={polygonPath(BLEND_AXES.map(() => r))}
              fill="none"
              stroke="#8f8b84"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          ))}
          {/* Spokes + labels */}
          {BLEND_AXES.map((axis, i) => {
            const [x, y] = radarPoint(i, 1);
            const [lx, ly] = radarPoint(i, 1.28);
            return (
              <g key={axis}>
                <line x1={CX} y1={CY} x2={x} y2={y} stroke="#8f8b84" strokeOpacity={0.35} strokeWidth={1} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#8f8b84"
                  fontSize={12}
                >
                  {AXIS_LABELS[axis]}
                </text>
              </g>
            );
          })}
          {/* Blend polygon */}
          <motion.path
            d={polygonPath(values01)}
            fill="#efebe4"
            fillOpacity={0.12}
            stroke="#efebe4"
            strokeWidth={1.5}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          />
          {values01.map((v, i) => {
            const [x, y] = radarPoint(i, v);
            return <circle key={i} cx={x} cy={y} r={2.2} fill="#efebe4" />;
          })}
        </svg>

        {/* Cohesion */}
        <div
          className="min-w-0 flex-1"
          title={
            cohesion
              ? `How well these spices pair with one another, averaged over ${cohesion.scoredPairCount} pair${cohesion.scoredPairCount !== 1 ? 's' : ''}.` +
                (profile.coveredCount < profile.totalCount ? ` The shape covers ${profile.coveredCount} of ${profile.totalCount} spices.` : '')
              : undefined
          }
        >
          {cohesion && verdict && (
            <>
              <p className="text-small text-chalk-2">Cohesion</p>
              <p className="font-display text-lead leading-tight text-chalk">{verdict.label}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Meter value={cohesion.score} className="flex-1" />
                <span className="text-small text-chalk-2">{cohesion.score.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Suggested ratio */}
      {ratios.length > 0 && (
        <div className="mt-3">
          <p className="text-small text-chalk-2">
            Start with {ratios.every((r) => r.parts === ratios[0].parts) ? 'equal parts' : 'parts by punch'}
          </p>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
            {ratios.map((r) => (
              <li
                key={r.spiceId}
                className="flex min-w-0 items-center gap-2 text-small text-chalk"
                title={`${ROLE_WORDS[r.role]}${r.estimated ? '. No intensity data, so medium punch is assumed.' : ''}`}
                {...hoverProps(tidToSlug.get(r.spiceId))}
              >
                <Swatch tid={r.spiceId} size={12} />
                <span className="w-3 shrink-0 text-right text-chalk-2">{r.parts}</span>
                <span className="truncate">{r.spiceName}</span>
                {r.estimated && <span className="text-chalk-3">*</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Save / share */}
      <div className="mt-3 flex items-center gap-2">
        {naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="flex flex-1 items-center gap-1.5"
          >
            <input
              autoFocus
              value={blendName}
              onChange={(e) => setBlendName(e.target.value)}
              placeholder="Name this blend"
              aria-label="Blend name"
              className="h-8 min-w-0 flex-1 rounded-md border border-rule bg-board-high px-2.5 text-small text-chalk outline-none placeholder:text-chalk-3 focus:border-rule-strong"
            />
            <SmallButton type="submit" pressed>
              Save
            </SmallButton>
            <SmallButton onClick={() => setNaming(false)} aria-label="Cancel">
              Cancel
            </SmallButton>
          </form>
        ) : (
          <>
            <SmallButton onClick={() => setNaming(true)} pressed>
              Save blend
            </SmallButton>
            <SmallButton onClick={handleShare}>Share link</SmallButton>
            {feedback && <span className="min-w-0 truncate text-small text-chalk-2">{feedback}</span>}
          </>
        )}
      </div>

      {/* Gap suggestions */}
      {gap && gap.suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span
            className="text-small text-chalk-2"
            title={`${AXIS_LABELS[gap.axis]} scores ${Math.round(gap.value)} out of 100. These would balance it.`}
          >
            Low on {AXIS_LABELS[gap.axis].toLowerCase()}:
          </span>
          {gap.suggestions.map((s) => {
            const slug = tidToSlug.get(s.spiceId);
            return (
              <SmallButton
                key={s.spiceId}
                disabled={!slug}
                onClick={() => {
                  if (!slug) return;
                  setHovered(null);
                  toggleSpice(slug);
                }}
                title={`Add ${s.spiceName}. ${AXIS_LABELS[gap.axis]} ${Math.round(s.axisValue)} out of 100, fit ${s.fit.toFixed(2)}`}
                className="h-7 gap-1.5 px-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                {...hoverProps(slug)}
              >
                <Swatch tid={s.spiceId} size={10} />
                {s.spiceName}
              </SmallButton>
            );
          })}
        </div>
      )}
    </section>
  );
}
