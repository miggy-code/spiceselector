'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { familyLabel } from '@/lib/colors';
import { spiceColor, luminance } from '@/lib/spice-colors';
import { THEME } from '@/lib/theme';
import { FLAVOR_DIM_COLORS } from '@/lib/flavor-dim-colors';
import { useSelection } from '@/context/SelectionContext';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { SpiceLabel, aromaWords, labelSize, placeLabels, type LabelItem, type LabelTone } from './FlavorAtlas';

const EDGE_TOP_N = 6;
const EDGE_MIN_SCORE = 0.5;
/** Most partner lines drawn at once; every partner dot is still marked. */
const MAX_LINES = 10;

interface SpiceData {
  id: string;
  name: string;
  family: string;
  warmth: number | null;
  brightness: number | null;
  earthiness: number | null;
  florality: number | null;
  heat: number | null;
  intensity: number | null;
  commonality: number | null;
  description: string | null;
}

type AxisKey = 'warmth' | 'brightness' | 'earthiness' | 'florality' | 'heat';

interface FlavorMap2DProps { data: SpiceData[]; }

const AXES: { key: AxisKey; label: string; low: string; high: string }[] = [
  { key: 'warmth', label: 'Warmth', low: 'cool', high: 'warming' },
  { key: 'brightness', label: 'Brightness', low: 'muted', high: 'bright' },
  { key: 'earthiness', label: 'Earthiness', low: 'clean', high: 'earthy' },
  { key: 'florality', label: 'Florality', low: 'neutral', high: 'floral' },
  { key: 'heat', label: 'Heat', low: 'mild', high: 'fiery' },
];

const ticks = [0, 25, 50, 75, 100];
type PositionedSpice = SpiceData & { x: number; y: number; anchorX: number; anchorY: number };
type Geometry = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };

function getGeometry(width: number, height: number): Geometry {
  const left = Math.max(42, Math.min(68, width * 0.08));
  const right = Math.max(14, Math.min(32, width * 0.035));
  const top = 28;
  const bottom = 48;
  return { width, height, left, right, top, bottom, plotWidth: Math.max(1, width - left - right), plotHeight: Math.max(1, height - top - bottom) };
}
function scaleX(value: number, geometry: Geometry) { return geometry.left + (value / 100) * geometry.plotWidth; }
function scaleY(value: number, geometry: Geometry) { return geometry.top + (1 - value / 100) * geometry.plotHeight; }
function radius(value: number | null, geometry: Geometry) { const v = Math.max(40, Math.min(100, value ?? 45)); return (5 + ((v - 40) / 60) * 8.5) * Math.min(1.15, Math.max(0.8, geometry.width / 800)); }
function axisFor(key: AxisKey) { return AXES.find((axis) => axis.key === key)!; }

/**
 * Many spices share coordinates (scores come in steps of 5). Relax the marks
 * just enough that none overlap, keeping each as close to its true value as possible.
 */
function spreadOverlappingPoints(data: SpiceData[], xAxis: AxisKey, yAxis: AxisKey, geometry: Geometry): PositionedSpice[] {
  const pts = [...data]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((spice, i) => {
      const ax = scaleX(spice[xAxis] as number, geometry);
      const ay = scaleY(spice[yAxis] as number, geometry);
      // Tiny deterministic seed offset so identical points can separate.
      return { ...spice, x: ax + Math.cos(i * 2.4) * 0.5, y: ay + Math.sin(i * 2.4) * 0.5, anchorX: ax, anchorY: ay, r: radius(spice.intensity, geometry) };
    });
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + 2.5;
        if (d >= min) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
    // Gentle pull back toward the true value.
    for (const p of pts) { p.x += (p.anchorX - p.x) * 0.04; p.y += (p.anchorY - p.y) * 0.04; }
  }
  return pts.map(({ r: _r, ...rest }) => { void _r; return rest; });
}

export default function FlavorMap2D({ data }: FlavorMap2DProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [xAxis, setXAxis] = useState<AxisKey>('warmth');
  const [yAxis, setYAxis] = useState<AxisKey>('brightness');
  const [showEdges, setShowEdges] = useState(true);
  const [plotSize, setPlotSize] = useState({ width: 720, height: 440 });
  const { selectedSpiceIds, toggleSpice, hoveredSpiceId: hoveredId, setHovered } = useSelection();

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setPlotSize({ width: Math.max(220, Math.round(rect.width)), height: Math.max(180, Math.round(rect.height)) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const validData = useMemo(() => data.filter((spice) => spice[xAxis] != null && spice[yAxis] != null), [data, xAxis, yAxis]);
  const geometry = useMemo(() => getGeometry(plotSize.width, plotSize.height), [plotSize]);
  const positioned = useMemo(() => spreadOverlappingPoints(validData, xAxis, yAxis, geometry), [validData, xAxis, yAxis, geometry]);
  const byId = useMemo(() => new Map(positioned.map((spice) => [spice.id, spice])), [positioned]);
  const { edges, connectedIds } = useMemo(() => {
    if (!showEdges || selectedSpiceIds.size === 0) return { edges: [] as { source: string; target: string; score: number }[], connectedIds: new Set<string>() };
    const taxonomyIds = new Map(positioned.map((spice) => [spice.id, toTaxonomyId(spice.id, spice.name)]));
    const edges: { source: string; target: string; score: number }[] = [];
    const connectedIds = new Set<string>();
    const seen = new Set<string>();
    for (const source of selectedSpiceIds) {
      const sourceTaxonomyId = taxonomyIds.get(source);
      if (!sourceTaxonomyId) continue;
      const partners = positioned.map((spice) => {
        const targetTaxonomyId = taxonomyIds.get(spice.id);
        return { target: spice.id, score: spice.id === source || !targetTaxonomyId || targetTaxonomyId === sourceTaxonomyId ? null : getAffinity(sourceTaxonomyId, targetTaxonomyId) };
      })
        .filter((partner): partner is { target: string; score: number } => partner.score !== null && partner.score >= EDGE_MIN_SCORE)
        .sort((a, b) => b.score - a.score).slice(0, EDGE_TOP_N);
      for (const partner of partners) {
        const key = [source, partner.target].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key); edges.push({ source, ...partner }); connectedIds.add(partner.target);
      }
    }
    edges.sort((a, b) => b.score - a.score);
    return { edges: edges.slice(0, MAX_LINES), connectedIds };
  }, [positioned, selectedSpiceIds, showEdges]);
  const toneOf = (id: string): LabelTone => (selectedSpiceIds.has(id) ? 'selected' : connectedIds.has(id) ? 'partner' : selectedSpiceIds.size ? 'dim' : 'quiet');
  // Laid out without hover, so labels hold still while the pointer moves.
  const labels = useMemo(() => {
    const rank = (id: string) => (selectedSpiceIds.has(id) ? 0 : connectedIds.has(id) ? 1 : 2);
    const items: LabelItem[] = [...positioned]
      .sort((a, b) => rank(a.id) - rank(b.id) || (b.commonality ?? 0) - (a.commonality ?? 0) || a.name.localeCompare(b.name))
      .map((spice) => {
        const tone: LabelTone = rank(spice.id) === 0 ? 'selected' : rank(spice.id) === 1 ? 'partner' : 'quiet';
        return { id: spice.id, x: spice.x, y: spice.y, r: radius(spice.intensity, geometry), ...labelSize(spice.name, tone), force: tone !== 'quiet' };
      });
    const dots = positioned.map((spice) => ({ id: spice.id, x: spice.x, y: spice.y, r: radius(spice.intensity, geometry) }));
    return placeLabels(items, dots, { x0: geometry.left + 2, y0: geometry.top + 2, x1: geometry.left + geometry.plotWidth - 2, y1: geometry.top + geometry.plotHeight - 2 });
  }, [positioned, selectedSpiceIds, connectedIds, geometry]);

  const x = axisFor(xAxis); const y = axisFor(yAxis); const hoverSpice = hoveredId ? byId.get(hoveredId) : undefined; const hasSelection = selectedSpiceIds.size > 0;
  function select(spice: SpiceData) { toggleSpice(spice.id); }
  function startHover(id: string) { setHovered(id); }
  function endHover() { setHovered(null); }
  function chooseXAxis(axis: AxisKey) { if (axis === yAxis) setYAxis(xAxis); setXAxis(axis); }
  function chooseYAxis(axis: AxisKey) { if (axis === xAxis) setXAxis(yAxis); setYAxis(axis); }

  return (
    <section className="relative flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-3 pt-2 text-chalk md:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-small text-chalk-2">
        <label className="flex items-center gap-2"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: FLAVOR_DIM_COLORS[xAxis] }} />Across</span>
          <select value={xAxis} onChange={(event) => chooseXAxis(event.target.value as AxisKey)} style={{ boxShadow: `inset 0 0 0 1px ${FLAVOR_DIM_COLORS[xAxis]}88` }} className="h-9 cursor-pointer rounded-md bg-board-high px-2.5 text-small font-medium text-chalk outline-none hover:brightness-110">
            {AXES.map((axis) => <option key={axis.key} value={axis.key}>{axis.label}</option>)}
          </select></label>
        <label className="flex items-center gap-2"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: FLAVOR_DIM_COLORS[yAxis] }} />Up</span>
          <select value={yAxis} onChange={(event) => chooseYAxis(event.target.value as AxisKey)} style={{ boxShadow: `inset 0 0 0 1px ${FLAVOR_DIM_COLORS[yAxis]}88` }} className="h-9 cursor-pointer rounded-md bg-board-high px-2.5 text-small font-medium text-chalk outline-none hover:brightness-110">
            {AXES.map((axis) => <option key={axis.key} value={axis.key}>{axis.label}</option>)}
          </select></label>
        <button type="button" role="switch" onClick={() => setShowEdges((value) => !value)} aria-checked={showEdges} className="flex h-9 items-center gap-2.5 rounded-md px-1 text-small font-medium text-chalk-2 hover:text-chalk">Recipe partners<span aria-hidden className={`flex h-5 w-9 rounded-full p-0.5 transition-colors duration-200 ${showEdges ? 'bg-chalk' : 'bg-board-high shadow-[inset_0_0_0_1px_rgba(243,239,232,0.2)]'}`}><span className={`block h-4 w-4 rounded-full transition-transform duration-200 ${showEdges ? 'translate-x-4 bg-board' : 'bg-chalk-3'}`} /></span></button>
      </div>
      <div ref={plotRef} className="min-h-0 flex-1 py-2">
        {positioned.length ? <svg className="block h-full w-full select-none" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-labelledby="axis-map-title axis-map-description">
          <title id="axis-map-title">Spices plotted by {x.label.toLowerCase()} and {y.label.toLowerCase()}</title><desc id="axis-map-description">Each dot is a spice. Location shows two flavor qualities; size shows intensity. Lines join selected spices to recipe partners.</desc>
          <defs>
            <filter id="axes-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.45" /></filter>
            <radialGradient id="axes-sheen" cx="35%" cy="30%" r="65%"><stop offset="0" stopColor="#fff" stopOpacity="0.32" /><stop offset="0.55" stopColor="#fff" stopOpacity="0" /></radialGradient>
          </defs>
          <rect x={geometry.left} y={geometry.top} width={geometry.plotWidth} height={geometry.plotHeight} rx="6" fill={THEME.boardDeep} fillOpacity=".5" />
          {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={scaleX(tick, geometry)} x2={scaleX(tick, geometry)} y1={geometry.top} y2={geometry.top + geometry.plotHeight} stroke={THEME.chalk} strokeOpacity={tick === 0 || tick === 100 ? 0.18 : 0.06} /><line x1={geometry.left} x2={geometry.left + geometry.plotWidth} y1={scaleY(tick, geometry)} y2={scaleY(tick, geometry)} stroke={THEME.chalk} strokeOpacity={tick === 0 || tick === 100 ? 0.18 : 0.06} />{tick % 50 === 0 && <><text x={scaleX(tick, geometry)} y={geometry.top + geometry.plotHeight + 21} textAnchor="middle" fill={THEME.chalk3} fontSize="12">{tick}</text><text x={geometry.left - 12} y={scaleY(tick, geometry) + 4} textAnchor="end" fill={THEME.chalk3} fontSize="12">{tick}</text></>}</g>)}
          <text x={geometry.left} y={geometry.top - 12} fill={FLAVOR_DIM_COLORS[yAxis]} fontSize="12.5" fontWeight="600">More {y.label.toLowerCase()} ↑</text><text x={geometry.left + geometry.plotWidth} y={geometry.top + geometry.plotHeight + 42} textAnchor="end" fill={FLAVOR_DIM_COLORS[xAxis]} fontSize="12.5" fontWeight="600">More {x.label.toLowerCase()} →</text>
          <g key={edges.map((e) => e.source + e.target).join('|') + xAxis + yAxis} className="atlas-edges">
            {edges.map((edge) => { const source = byId.get(edge.source); const target = byId.get(edge.target); if (!source || !target) return null; const t = (edge.score - EDGE_MIN_SCORE) / (1 - EDGE_MIN_SCORE); return <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={THEME.chalk} strokeOpacity={0.3 + t * 0.6} strokeWidth={1 + t * 2.4} strokeLinecap="round" />; })}
          </g>
          {positioned.map((spice) => {
            const selected = selectedSpiceIds.has(spice.id); const connected = connectedIds.has(spice.id); const dimmed = hasSelection && !selected && !connected;
            const color = spiceColor(spice.id, spice.name, spice.family); const r = radius(spice.intensity, geometry);
            return (
              <g key={spice.id} data-spice-id={spice.id} role="button" tabIndex={0} aria-label={`${spice.name}, ${familyLabel(spice.family)}. ${x.label} ${spice[xAxis]}, ${y.label} ${spice[yAxis]}. ${selected ? 'Selected' : 'Press Enter to select.'}`} aria-pressed={selected} className="atlas-node cursor-pointer outline-none" style={{ transform: `translate(${spice.x}px, ${spice.y}px)`, opacity: dimmed ? 0.28 : 1, transition: 'transform 700ms var(--ease-out-soft), opacity 300ms ease' }} onClick={() => select(spice)} onPointerEnter={() => startHover(spice.id)} onPointerLeave={endHover} onFocus={() => startHover(spice.id)} onBlur={endHover} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(spice); } }}>
                <circle r={r + 8} fill="transparent" />
                <circle className="atlas-ring" r={r + 4.5} fill="none" stroke={THEME.chalk} strokeWidth={selected ? 2.2 : 1.2} style={{ opacity: selected ? 0.95 : connected ? 0.5 : 0 }} />
                <g className="atlas-dot" filter="url(#axes-shadow)">
                  <circle r={r} fill={color} stroke={luminance(color) < 0.05 ? 'rgba(243,239,232,0.5)' : 'rgba(0,0,0,0.25)'} strokeWidth="1" />
                  <circle r={r} fill="url(#axes-sheen)" />
                </g>
              </g>
            );
          })}
          {positioned.map((spice) => {
            const at = labels.get(spice.id);
            if (!at || spice.id === hoveredId) return null;
            const tone = toneOf(spice.id);
            return <SpiceLabel key={`label-${spice.id}`} name={spice.name} x={at.x} y={at.y} tone={tone} color={spiceColor(spice.id, spice.name, spice.family)} {...labelSize(spice.name, tone === 'dim' ? 'quiet' : tone)} />;
          })}
          {/* The hovered spice, wherever the pointer came from, is raised above everything else. */}
          {hoverSpice && (() => {
            const r = radius(hoverSpice.intensity, geometry); const tone: LabelTone = selectedSpiceIds.has(hoverSpice.id) ? 'selected' : 'hover'; const size = labelSize(hoverSpice.name, tone);
            const at = labels.get(hoverSpice.id) ?? { x: Math.max(geometry.left + size.w / 2, Math.min(geometry.left + geometry.plotWidth - size.w / 2, hoverSpice.x)), y: Math.min(geometry.top + geometry.plotHeight - size.h / 2, hoverSpice.y + r + 4 + size.h / 2) };
            return (
              <g pointerEvents="none">
                <g transform={`translate(${hoverSpice.x} ${hoverSpice.y})`}>
                  <circle r={r + 4.5} fill="none" stroke={THEME.chalk} strokeWidth={1.8} opacity={0.9} />
                  <circle r={r * 1.12} fill={spiceColor(hoverSpice.id, hoverSpice.name, hoverSpice.family)} stroke="rgba(243,239,232,0.6)" strokeWidth="1" />
                </g>
                <SpiceLabel name={hoverSpice.name} x={at.x} y={at.y} tone={tone} color={spiceColor(hoverSpice.id, hoverSpice.name, hoverSpice.family)} {...size} />
              </g>
            );
          })()}
        </svg> : <div className="grid h-full min-h-[260px] place-items-center p-8 text-center"><div><p className="font-display text-title text-chalk-2">No spices match.</p></div></div>}
      </div>
      <div className="min-h-8 shrink-0 truncate border-t border-rule pt-2 text-small leading-snug text-chalk-3">{hoverSpice && <p className="truncate"><span className="font-display text-lead text-chalk">{hoverSpice.name}</span><span className="ml-2">{[familyLabel(hoverSpice.family), `${x.label.toLowerCase()} ${hoverSpice[xAxis]}`, `${y.label.toLowerCase()} ${hoverSpice[yAxis]}`, ...aromaWords(hoverSpice, 2)].join(' · ')}</span></p>}</div>
    </section>
  );
}
