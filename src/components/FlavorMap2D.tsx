'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { familyLabel } from '@/lib/colors';
import { spiceColor, luminance } from '@/lib/spice-colors';
import { THEME } from '@/lib/theme';
import { useSelection } from '@/context/SelectionContext';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';

const EDGE_TOP_N = 6;
const EDGE_MIN_SCORE = 0.5;

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [plotSize, setPlotSize] = useState({ width: 720, height: 440 });
  const { selectedSpiceIds, toggleSpice, setHovered } = useSelection();

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
    return { edges, connectedIds };
  }, [positioned, selectedSpiceIds, showEdges]);
  const labels = useMemo(() => {
    if (selectedSpiceIds.size || hoveredId) return positioned.filter((spice) => selectedSpiceIds.has(spice.id) || spice.id === hoveredId);
    return [...positioned].sort((a, b) => ((b.commonality ?? 0) + (b.intensity ?? 0)) - ((a.commonality ?? 0) + (a.intensity ?? 0))).slice(0, 7);
  }, [positioned, selectedSpiceIds, hoveredId]);

  const x = axisFor(xAxis); const y = axisFor(yAxis); const hoverSpice = hoveredId ? byId.get(hoveredId) : undefined; const hasSelection = selectedSpiceIds.size > 0;
  function select(spice: SpiceData) { toggleSpice(spice.id); }
  function startHover(id: string) { setHoveredId(id); setHovered(id); }
  function endHover() { setHoveredId(null); setHovered(null); }
  function chooseXAxis(axis: AxisKey) { if (axis === yAxis) setYAxis(xAxis); setXAxis(axis); }
  function chooseYAxis(axis: AxisKey) { if (axis === xAxis) setXAxis(yAxis); setYAxis(axis); }

  return (
    <section className="relative flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-3 pt-2 text-chalk md:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-small text-chalk-2">
        <label className="flex items-center gap-2">Across
          <select value={xAxis} onChange={(event) => chooseXAxis(event.target.value as AxisKey)} className="h-9 cursor-pointer rounded-md bg-board-high px-2.5 text-small font-medium text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14)] outline-none hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.3)]">
            {AXES.map((axis) => <option key={axis.key} value={axis.key}>{axis.label}</option>)}
          </select></label>
        <label className="flex items-center gap-2">Up
          <select value={yAxis} onChange={(event) => chooseYAxis(event.target.value as AxisKey)} className="h-9 cursor-pointer rounded-md bg-board-high px-2.5 text-small font-medium text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14)] outline-none hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.3)]">
            {AXES.map((axis) => <option key={axis.key} value={axis.key}>{axis.label}</option>)}
          </select></label>
        <button type="button" role="switch" onClick={() => setShowEdges((value) => !value)} aria-checked={showEdges} className="flex h-9 items-center gap-2.5 rounded-md px-1 text-small font-medium text-chalk-2 hover:text-chalk">Show recipe partners<span aria-hidden className={`flex h-5 w-9 rounded-full p-0.5 transition-colors duration-200 ${showEdges ? 'bg-chalk' : 'bg-board-high shadow-[inset_0_0_0_1px_rgba(243,239,232,0.2)]'}`}><span className={`block h-4 w-4 rounded-full transition-transform duration-200 ${showEdges ? 'translate-x-4 bg-board' : 'bg-chalk-3'}`} /></span></button>
      </div>
      <div ref={plotRef} className="min-h-0 flex-1 py-2">
        {positioned.length ? <svg className="block h-full w-full select-none" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-labelledby="axis-map-title axis-map-description">
          <title id="axis-map-title">Spices plotted by {x.label.toLowerCase()} and {y.label.toLowerCase()}</title><desc id="axis-map-description">Each dot is a spice in its own color. Location represents two flavor qualities; size represents intensity. Chalk lines show recipe partners after selecting a spice.</desc>
          <defs>
            <filter id="axes-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.45" /></filter>
            <radialGradient id="axes-sheen" cx="35%" cy="30%" r="65%"><stop offset="0" stopColor="#fff" stopOpacity="0.32" /><stop offset="0.55" stopColor="#fff" stopOpacity="0" /></radialGradient>
          </defs>
          <rect x={geometry.left} y={geometry.top} width={geometry.plotWidth} height={geometry.plotHeight} rx="6" fill={THEME.boardDeep} fillOpacity=".5" />
          {ticks.map((tick) => <g key={tick} aria-hidden="true"><line x1={scaleX(tick, geometry)} x2={scaleX(tick, geometry)} y1={geometry.top} y2={geometry.top + geometry.plotHeight} stroke={THEME.chalk} strokeOpacity={tick === 0 || tick === 100 ? 0.18 : 0.06} /><line x1={geometry.left} x2={geometry.left + geometry.plotWidth} y1={scaleY(tick, geometry)} y2={scaleY(tick, geometry)} stroke={THEME.chalk} strokeOpacity={tick === 0 || tick === 100 ? 0.18 : 0.06} /><text x={scaleX(tick, geometry)} y={geometry.top + geometry.plotHeight + 21} textAnchor="middle" fill={THEME.chalk3} fontSize="12.5">{tick}</text><text x={geometry.left - 12} y={scaleY(tick, geometry) + 4} textAnchor="end" fill={THEME.chalk3} fontSize="12.5">{tick}</text></g>)}
          <text x={geometry.left} y={geometry.top - 12} fill={THEME.chalk2} fontSize="13.5" fontWeight="500">More {y.label.toLowerCase()}</text><text x={geometry.left + geometry.plotWidth} y={geometry.top + geometry.plotHeight + 42} textAnchor="end" fill={THEME.chalk2} fontSize="13.5" fontWeight="500">More {x.label.toLowerCase()}</text>
          <g key={edges.map((e) => e.source + e.target).join('|') + xAxis + yAxis} className="atlas-edges">
            {edges.map((edge) => { const source = byId.get(edge.source); const target = byId.get(edge.target); if (!source || !target) return null; const t = (edge.score - EDGE_MIN_SCORE) / (1 - EDGE_MIN_SCORE); return <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={THEME.chalk} strokeOpacity={0.3 + t * 0.6} strokeWidth={1 + t * 2.4} strokeLinecap="round" />; })}
          </g>
          {positioned.map((spice) => {
            const selected = selectedSpiceIds.has(spice.id); const connected = connectedIds.has(spice.id); const dimmed = hasSelection && !selected && !connected;
            const color = spiceColor(spice.id, spice.name, spice.family); const r = radius(spice.intensity, geometry);
            return (
              <g key={spice.id} data-spice-id={spice.id} role="button" tabIndex={0} aria-label={`${spice.name}, ${familyLabel(spice.family)}. ${x.label} ${spice[xAxis]}, ${y.label} ${spice[yAxis]}. ${selected ? 'Selected' : 'Press Enter to select.'}`} aria-pressed={selected} className="atlas-node cursor-pointer outline-none" style={{ transform: `translate(${spice.x}px, ${spice.y}px)`, opacity: dimmed ? 0.28 : 1, transition: 'transform 700ms var(--ease-out-soft), opacity 300ms ease' }} onClick={() => select(spice)} onPointerEnter={() => startHover(spice.id)} onPointerLeave={endHover} onFocus={() => startHover(spice.id)} onBlur={endHover} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(spice); } }}>
                <circle r={r + 8} fill="transparent" />
                <circle className="atlas-ring" r={r + 4.5} fill="none" stroke={THEME.chalk} strokeWidth={selected ? 2.2 : 1.2} style={{ opacity: selected ? 0.95 : connected ? 0.45 : 0 }} />
                <g className="atlas-dot" filter="url(#axes-shadow)">
                  <circle r={r} fill={color} stroke={luminance(color) < 0.05 ? 'rgba(243,239,232,0.5)' : 'rgba(0,0,0,0.25)'} strokeWidth="1" />
                  <circle r={r} fill="url(#axes-sheen)" />
                </g>
              </g>
            );
          })}
          {labels.map((spice) => { const rightAligned = spice.x > geometry.left + geometry.plotWidth * 0.78; const r = radius(spice.intensity, geometry); const sel = selectedSpiceIds.has(spice.id); const w = spice.name.length * 7.3 + 14; const lx = rightAligned ? -r - 8 - w : r + 8; return (
            <g key={`label-${spice.id}`} pointerEvents="none" className="atlas-label" style={{ transform: `translate(${spice.x}px, ${spice.y}px)` }}>
              <rect x={lx} y={-10} width={w} height={20} rx={5} fill={sel ? THEME.chalk : THEME.boardRaised} stroke={sel ? 'none' : 'rgba(243,239,232,0.14)'} />
              <text x={lx + w / 2} y={4.5} textAnchor="middle" fill={sel ? THEME.board : spice.id === hoveredId ? THEME.chalk : THEME.chalk2} fontSize="13" fontWeight={sel ? 600 : 500}>{spice.name}</text>
            </g>); })}
        </svg> : <div className="grid h-full min-h-[260px] place-items-center p-8 text-center"><div><p className="font-display text-title text-chalk-2">No spices match.</p><p className="mt-1 text-body text-chalk-3">Clear the cuisine or heat filter to bring them back.</p></div></div>}
      </div>
      <div className="min-h-[44px] shrink-0 border-t border-rule pt-2.5 text-small leading-snug text-chalk-3">{hoverSpice ? <p><span className="font-display text-lead text-chalk">{hoverSpice.name}</span><span className="ml-2">{x.label.toLowerCase()} {hoverSpice[xAxis]}, {y.label.toLowerCase()} {hoverSpice[yAxis]}</span></p> : <p>Position shows two flavor qualities on a 0 to 100 scale, and dot size shows intensity.{hasSelection && showEdges ? ` Chalk lines join your spices to their ${edges.length} strongest recipe partners.` : ''}</p>}</div>
    </section>
  );
}
