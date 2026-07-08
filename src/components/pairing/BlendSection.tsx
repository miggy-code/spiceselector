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
import { FAMILY_COLORS } from '@/lib/colors';

const ROLE_COLORS: Record<string, string> = {
  base: '#34d399',
  support: '#22d3ee',
  accent: '#fbbf24',
};

const AXIS_LABELS: Record<BlendAxis, string> = {
  warmth: 'Warm',
  brightness: 'Bright',
  earthiness: 'Earthy',
  florality: 'Floral',
  heat: 'Heat',
};

function cohesionVerdict(score: number): { label: string; color: string } {
  if (score >= 0.7) return { label: 'harmonious', color: '#34d399' };
  if (score >= 0.55) return { label: 'balanced', color: '#22d3ee' };
  return { label: 'adventurous', color: '#fbbf24' };
}

const RADAR_SIZE = 190;
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
 * it hangs together (cohesion), and what would balance it (gap suggestions).
 */
export default function BlendSection({ selectedTids, tidToSlug }: BlendSectionProps) {
  const { toggleSpice } = useSelection();
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
    flash('saved ✓');
  }

  async function handleShare() {
    const url = encodeBlendUrl(selectedSlugs, blendName || undefined);
    try {
      await navigator.clipboard.writeText(url);
      flash('link copied ✓');
    } catch {
      flash(url); // clipboard blocked — at least show the link
    }
  }

  if (!analysis) return null;
  const { profile, cohesion, gap, ratios } = analysis;
  const values01 = BLEND_AXES.map((a) => profile.axes[a] / 100);
  const verdict = cohesion ? cohesionVerdict(cohesion.score) : null;

  return (
    <div className="px-4 py-3 border-b border-white/8">
      <p className="text-[10px] uppercase tracking-widest text-cyan-300/70 mb-1 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
        Your blend
      </p>

      <div className="flex items-center gap-3">
        {/* Radar */}
        <svg
          width={RADAR_SIZE * 0.85}
          height={RADAR_SIZE * 0.85}
          viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
          className="flex-shrink-0"
          role="img"
          aria-label="Blend flavor profile radar"
        >
          {/* Grid rings */}
          {[0.33, 0.66, 1].map((r) => (
            <path
              key={r}
              d={polygonPath(BLEND_AXES.map(() => r))}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          ))}
          {/* Spokes + labels */}
          {BLEND_AXES.map((axis, i) => {
            const [x, y] = radarPoint(i, 1);
            const [lx, ly] = radarPoint(i, 1.28);
            return (
              <g key={axis}>
                <line x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white/45"
                  fontSize={11}
                >
                  {AXIS_LABELS[axis]}
                </text>
              </g>
            );
          })}
          {/* Blend polygon */}
          <motion.path
            d={polygonPath(values01)}
            fill="rgba(34,211,238,0.16)"
            stroke="#22d3ee"
            strokeWidth={1.5}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ transformOrigin: `${CX}px ${CY}px`, filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.6))' }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          />
          {values01.map((v, i) => {
            const [x, y] = radarPoint(i, v);
            return <circle key={i} cx={x} cy={y} r={2.2} fill="#22d3ee" />;
          })}
        </svg>

        {/* Cohesion */}
        <div className="flex-1 min-w-0">
          {cohesion && verdict && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-white/35">Cohesion</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 flex-1 rounded-full bg-neutral-700/80 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(cohesion.score * 100)}%`,
                      backgroundColor: verdict.color,
                      boxShadow: `0 0 6px ${verdict.color}b0`,
                    }}
                  />
                </div>
                <span className="text-[10px] tabular-nums" style={{ color: verdict.color }}>
                  {cohesion.score.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: verdict.color }}>
                {verdict.label}
              </p>
              <p className="text-[10px] text-white/35 mt-0.5">
                mean pairing evidence over {cohesion.scoredPairCount} pair
                {cohesion.scoredPairCount !== 1 ? 's' : ''}
              </p>
            </>
          )}
          {profile.coveredCount < profile.totalCount && (
            <p className="text-[9px] text-white/25 mt-1">
              profile covers {profile.coveredCount}/{profile.totalCount} spices
            </p>
          )}
        </div>
      </div>

      {/* Suggested ratio */}
      {ratios.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[10px] uppercase tracking-wider text-white/35">
            Suggested start{' '}
            <span className="normal-case tracking-normal">
              {ratios.every((r) => r.parts === ratios[0].parts) ? '· equal parts' : '· by punch'}
            </span>
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {ratios.map((r) => (
              <span key={r.spiceId} className="text-[11px] text-white/70" title={`${r.role}${r.estimated ? ' (intensity estimated)' : ''}`}>
                <span className="tabular-nums font-semibold" style={{ color: ROLE_COLORS[r.role] }}>
                  {r.parts}
                </span>{' '}
                {r.spiceName}
                {r.estimated && <span className="text-white/30">*</span>}
              </span>
            ))}
          </div>
          {ratios.some((r) => r.estimated) && (
            <p className="text-[9px] text-white/25 mt-0.5">* no intensity data — assumed medium</p>
          )}
        </div>
      )}

      {/* Save / share */}
      <div className="flex items-center gap-2 mt-2.5">
        {naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="flex items-center gap-1.5 flex-1"
          >
            <input
              autoFocus
              value={blendName}
              onChange={(e) => setBlendName(e.target.value)}
              placeholder="Name this blend…"
              className="flex-1 min-w-0 text-[11px] bg-neutral-900 border border-cyan-400/30 rounded-full px-2.5 py-1 text-white/85 placeholder:text-white/25 focus:outline-none focus:border-cyan-400/60"
            />
            <button
              type="submit"
              className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/25 transition-all"
            >
              save
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="text-white/30 hover:text-white/70 text-[13px] leading-none px-0.5 transition-colors"
              aria-label="Cancel"
            >
              ×
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_10px_rgba(34,211,238,0.35)] transition-all"
            >
              ♥ Save blend
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 text-white/60 hover:text-white/90 hover:border-white/30 transition-all"
            >
              ⤴ Share link
            </button>
            {feedback && (
              <span className="text-[10px] text-emerald-300 truncate min-w-0">{feedback}</span>
            )}
          </>
        )}
      </div>

      {/* Gap suggestions */}
      {gap && gap.suggestions.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[11px] text-white/55">
            Low <span className="text-cyan-300">{AXIS_LABELS[gap.axis].toLowerCase()}</span>{' '}
            ({Math.round(gap.value)}/100) — these would balance it:
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {gap.suggestions.map((s) => {
              const slug = tidToSlug.get(s.spiceId);
              return (
                <button
                  key={s.spiceId}
                  type="button"
                  disabled={!slug}
                  onClick={() => slug && toggleSpice(slug)}
                  title={`${AXIS_LABELS[gap.axis]} ${Math.round(s.axisValue)}/100 · fit ${s.fit.toFixed(2)}`}
                  className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-100 text-[11px] hover:bg-cyan-500/20 hover:shadow-[0_0_10px_rgba(34,211,238,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FAMILY_COLORS[s.spiceId.split('.')[0]] ?? '#888' }}
                  />
                  + {s.spiceName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
