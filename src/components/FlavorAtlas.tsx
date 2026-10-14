'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import atlas from '@/data/flavor-atlas.json';
import { useSelection } from '@/context/SelectionContext';
import { familyLabel } from '@/lib/colors';
import { spiceColor, luminance } from '@/lib/spice-colors';
import { THEME } from '@/lib/theme';
import { SmallButton } from '@/components/pairing/ui';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';
import type { SpiceProfile } from '@/types/spice';

type Point = { spice: SpiceProfile; x: number; y: number; hidden?: boolean };
type Edge = { source: string; target: string; score: number };
const coordinates = atlas.points as Record<string, { x: number; y: number }>;
// Always use the full atlas extent: cuisine/heat lenses must not rearrange the map.
const allPoints = Object.values(coordinates);
const xExtent = [Math.min(...allPoints.map(p => p.x)), Math.max(...allPoints.map(p => p.x))];
const yExtent = [Math.min(...allPoints.map(p => p.y)), Math.max(...allPoints.map(p => p.y))];

const QUALITIES = [
  ['warmth', 'warmer', 'cooler'],
  ['brightness', 'brighter', 'more muted'],
  ['earthiness', 'earthier', 'cleaner'],
  ['florality', 'more floral', 'less floral'],
  ['heat', 'hotter', 'milder'],
] as const;

/**
 * Name each atlas direction by the flavor qualities that change most along it
 * (Pearson correlation of position with each quality). The projection has no
 * fixed meaning, so we read it back from the data instead of asserting one.
 */
function describeDirections(data: SpiceProfile[]) {
  const pts = data.filter(s => coordinates[s.id]);
  const corr = (xs: number[], ys: number[]) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  };
  const side = (dim: 'x' | 'y') => {
    const pos = pts.map(s => coordinates[s.id][dim]);
    const r = QUALITIES.map(([key, up, down]) => ({ up, down, r: corr(pos, pts.map(s => s[key] as number)) }))
      .filter(q => Math.abs(q.r) >= 0.35)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 2);
    return {
      high: r.map(q => (q.r > 0 ? q.up : q.down)).join(', '),
      low: r.map(q => (q.r > 0 ? q.down : q.up)).join(', '),
    };
  };
  return { x: side('x'), y: side('y') };
}

export default function FlavorAtlas({ data }: { data: SpiceProfile[] }) {
  const { selectedSpiceIds, toggleSpice } = useSelection();
  const [pairingFocus, setPairingFocus] = useState(true);
  const [inspected, setInspected] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });
  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selected = useMemo(() => data.filter(s => selectedSpiceIds.has(s.id)), [data, selectedSpiceIds]);
  const focused = pairingFocus && selected.length > 0;
  const { edges, partners, unscored } = useMemo(() => {
    const edges: Edge[] = [];
    const seen = new Set<string>();
    const partners = new Set<string>();
    const unscored: string[] = [];
    for (const spice of selected) {
      const sourceId = toTaxonomyId(spice.id, spice.name);
      if (!sourceId) { unscored.push(spice.name); continue; }
      const candidates = data.flatMap(target => {
        const targetId = toTaxonomyId(target.id, target.name);
        if (!targetId || targetId === sourceId) return [];
        const score = getAffinity(sourceId, targetId);
        return score === null ? [] : [{ target: target.id, score }];
      }).sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
      if (!candidates.length) unscored.push(spice.name);
      // Rank locally; a fixed 0.5 cutoff passed nearly the entire dataset.
      const chosen = candidates.slice(0, 5);
      for (const { target, score } of chosen) {
        const key = [spice.id, target].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key); partners.add(target);
        edges.push({ source: spice.id, target, score });
      }
    }
    return { edges, partners, unscored };
  }, [selected, data]);

  const nodes = useMemo(() => {
    const { width, height } = size;
    const padding = Math.min(56, width * .16);
    const top = Math.min(50, height * .15);
    const bottom = Math.min(44, height * .15);
    const x = scaleLinear().domain(xExtent).range([padding, width - padding]);
    const y = scaleLinear().domain(yExtent).range([height - bottom, top]);
    const shown = focused ? data.filter(s => selectedSpiceIds.has(s.id) || partners.has(s.id)) : data;
    const points: Point[] = [];
    if (focused) {
      const cx = width / 2, cy = height / 2;
      const centerRadius = selected.length === 1 ? 0 : Math.min(width, height) * .14;
      const outer = shown.filter(s => !selectedSpiceIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
      selected.forEach((spice, i) => {
        const angle = i / selected.length * Math.PI * 2 - Math.PI / 2;
        points.push({ spice, x: cx + Math.cos(angle) * centerRadius, y: cy + Math.sin(angle) * centerRadius });
      });
      outer.forEach((spice, i) => {
        const angle = i / outer.length * Math.PI * 2 - Math.PI / 2;
        points.push({ spice, x: cx + Math.cos(angle) * Math.max(0, width / 2 - padding), y: cy + Math.sin(angle) * Math.max(0, height / 2 - top) });
      });
    } else {
      shown.forEach(spice => {
        const p = coordinates[spice.id];
        if (p) points.push({ spice, x: x(p.x), y: y(p.y) });
      });
    }
    // Small deterministic displacement keeps almost identical profiles pickable.
    // Full flavor coordinates stay fixed; only the marks separate on screen.
    for (let iteration = 0; iteration < 30; iteration++) {
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy), gap = focused ? 30 : 21;
        if (distance >= gap) continue;
        if (distance < .01) { dx = Math.cos(i + j); dy = Math.sin(i + j); }
        const norm = Math.hypot(dx, dy), shift = (gap - distance) / 2;
        a.x -= dx / norm * shift; a.y -= dy / norm * shift;
        b.x += dx / norm * shift; b.y += dy / norm * shift;
      }
      for (const p of points) { p.x = Math.max(20, Math.min(width - 20, p.x)); p.y = Math.max(22, Math.min(height - 28, p.y)); }
    }
    // Retain SVG marks so layout changes interpolate in both directions.
    if (focused) {
      for (const spice of data) {
        if (selectedSpiceIds.has(spice.id) || partners.has(spice.id)) continue;
        const p = coordinates[spice.id];
        if (p) points.push({ spice, x: x(p.x), y: y(p.y), hidden: true });
      }
    }
    return points;
  }, [data, size, focused, partners, selected, selectedSpiceIds]);
  const byId = new Map(nodes.map(p => [p.spice.id, p]));
  const detail = data.find(s => s.id === inspected);
  const directions = useMemo(() => describeDirections(data), [data]);
  // Avoid text collisions: selected and inspected names get priority.
  const labels = useMemo(() => {
    const boxes: { x: number; y: number; width: number }[] = [];
    const candidates = [...nodes].sort((a,b) => Number(selectedSpiceIds.has(b.spice.id) || b.spice.id === inspected) - Number(selectedSpiceIds.has(a.spice.id) || a.spice.id === inspected) || b.spice.commonality - a.spice.commonality);
    const result = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' }>();
    for (const p of candidates) {
      if (p.hidden) continue;
      if (!focused && !selectedSpiceIds.has(p.spice.id) && p.spice.id !== inspected && result.size >= Math.max(5, Math.floor(size.width / 46))) continue;
      const width = p.spice.name.length * 7.3 + 14;
      const x = Math.max(width / 2 + 4, Math.min(size.width - width / 2 - 4, p.x));
      const y = p.y > size.height - 48 ? p.y - 22 : p.y + 26;
      const box = { x: x - width / 2, y: y - 12, width };
      if (!focused && boxes.some(b => box.x < b.x + b.width + 8 && box.x + width + 8 > b.x && Math.abs(box.y - b.y) < 22)) continue;
      boxes.push(box); result.set(p.spice.id, { x, y, anchor: 'middle' });
    }
    return result;
  }, [nodes, selectedSpiceIds, inspected, focused, size]);

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-3 pt-2 md:px-6">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-small leading-snug text-chalk-2">{focused ? 'Your spices sit in the middle, ringed by their strongest recipe partners.' : 'Choose any spice to pull its partners into view.'}</p>
        {selected.length > 0 && (
          <SmallButton onClick={() => setPairingFocus(v => !v)} role="switch" aria-checked={pairingFocus}>
            {pairingFocus ? 'Show the whole atlas' : 'Focus on pairings'}
          </SmallButton>
        )}
      </div>
      <div ref={plotRef} className="relative min-h-0 flex-1 overflow-hidden">
        {nodes.length === 0 ? <div className="flex h-full items-center justify-center p-6 text-center text-body text-chalk-3">No spices match these filters. Try another cuisine or heat level.</div> : (
          <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={focused ? 'Selected spices and their top recipe partners' : 'Flavor atlas. Select a spice to explore pairings'}>
            <title>{focused ? 'Recipe pairing neighborhood' : 'Five-dimensional flavor atlas'}</title>
            <defs>
              <filter id="atlas-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.45" />
              </filter>
              <radialGradient id="atlas-sheen" cx="35%" cy="30%" r="65%">
                <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
                <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g pointerEvents="none" fill={THEME.chalk3} fontSize="13" style={{ opacity: focused ? 0 : 1, transition: 'opacity 400ms ease' }}>
              {directions.x.high && <text x={size.width - 4} y={size.height / 2 - 10} textAnchor="end">{directions.x.high}</text>}
              {directions.x.low && <text x={4} y={size.height / 2 - 10}>{directions.x.low}</text>}
              {directions.y.high && <text x={size.width / 2} y={15} textAnchor="middle">{directions.y.high}</text>}
              {directions.y.low && <text x={size.width / 2} y={size.height - 4} textAnchor="middle">{directions.y.low}</text>}
            </g>
            {/* Lines fade in once the spices have travelled to their places. */}
            <g key={edges.map(e => e.source + e.target).join('|') + (focused ? 'f' : 'a')} className="atlas-edges">
              {edges.map(e => {
                const a = byId.get(e.source), b = byId.get(e.target);
                if (!a || !b) return null;
                // Curved, tinted by the chosen spice, bowing away from the centre, ending at the ring.
                const cx = size.width / 2, cy = size.height / 2;
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                const ox = mx - cx, oy = my - cy, ol = Math.hypot(ox, oy) || 1;
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                const qx = mx + (ox / ol) * len * 0.18, qy = my + (oy / ol) * len * 0.18;
                const trim = (px: number, py: number, tx: number, ty: number, r: number) => { const d = Math.hypot(tx - px, ty - py) || 1; return [px + ((tx - px) / d) * r, py + ((ty - py) / d) * r]; };
                const [sx, sy] = trim(a.x, a.y, qx, qy, 20), [ex, ey] = trim(b.x, b.y, qx, qy, 20);
                const tint = spiceColor(a.spice.id, a.spice.name, a.spice.family);
                const rank = Math.max(0, Math.min(1, (e.score - 0.5) / 0.45));
                return <path key={[e.source, e.target].sort().join('|')} d={`M${sx},${sy} Q${qx},${qy} ${ex},${ey}`} fill="none" stroke={luminance(tint) < 0.05 ? THEME.chalk2 : tint} strokeWidth={1.2 + rank * 1.8} strokeLinecap="round" opacity={0.4 + rank * 0.5}><title>{a.spice.name} + {b.spice.name}: recipe affinity {e.score.toFixed(2)}</title></path>;
              })}
            </g>
            {nodes.map(p => {
              const selected = selectedSpiceIds.has(p.spice.id), active = inspected === p.spice.id;
              const color = spiceColor(p.spice.id, p.spice.name, p.spice.family);
              const r = (focused ? 13 : 8.5) + p.spice.intensity / 100 * 5;
              return (
                <g key={p.spice.id} data-spice-id={p.spice.id} className="atlas-node" aria-hidden={p.hidden || undefined} style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity: p.hidden ? 0 : 1, pointerEvents: p.hidden ? 'none' : undefined }}>
                  <circle className="atlas-ring" r={r + 5} fill="none" stroke={THEME.chalk} strokeWidth={selected ? 2.2 : 1.2} style={{ opacity: selected ? 0.95 : active ? 0.5 : 0 }} />
                  <g className="atlas-dot" filter="url(#atlas-shadow)">
                    <circle r={r} fill={color} stroke={luminance(color) < 0.05 ? 'rgba(243,239,232,0.5)' : 'rgba(0,0,0,0.25)'} strokeWidth="1" />
                    <circle r={r} fill="url(#atlas-sheen)" />
                  </g>
                  <circle r={focused ? 24 : 18} fill="transparent" role="button" tabIndex={p.hidden ? -1 : 0} aria-label={`${p.spice.name}, ${familyLabel(p.spice.family)}. ${selected ? 'Remove from' : 'Add to'} selection.`} aria-pressed={selected} onClick={() => { setInspected(p.spice.id); toggleSpice(p.spice.id); }} onPointerEnter={() => setInspected(p.spice.id)} onFocus={() => setInspected(p.spice.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleSpice(p.spice.id); } }} className="cursor-pointer outline-none"><title>{p.spice.name}</title></circle>
                </g>
              );
            })}
            {nodes.map(p => {
              const label = labels.get(p.spice.id);
              if (!label) return null;
              const selected = selectedSpiceIds.has(p.spice.id), active = inspected === p.spice.id;
              const w = p.spice.name.length * 7.3 + 14;
              return (
                <g key={`label-${p.spice.id}`} className="atlas-label" pointerEvents="none" style={{ transform: `translate(${label.x}px, ${label.y + (focused ? 8 : 2)}px)` }}>
                  <rect x={-w / 2} y={-13} width={w} height={20} rx={5} fill={selected ? THEME.chalk : THEME.boardRaised} stroke={selected ? 'none' : 'rgba(243,239,232,0.14)'} />
                  <text y={1.5} textAnchor="middle" fill={selected ? THEME.board : active ? THEME.chalk : THEME.chalk2} fontSize="13" fontWeight={selected ? 600 : 500}>{p.spice.name}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <div className="mt-2 min-h-[44px] shrink-0 border-t border-rule pt-2.5 text-small leading-snug text-chalk-3">
        {detail ? (
          <p>
            <span className="font-display text-lead text-chalk">{detail.name}</span>
            <span className="ml-2">warmth {detail.warmth}, brightness {detail.brightness}, earthiness {detail.earthiness}, florality {detail.florality}, heat {detail.heat}</span>
          </p>
        ) : (
          <p>{focused ? 'Lines show recipe partners, not flavor similarity. Stronger partners have bolder lines.' : 'Position summarizes all five flavor qualities at once, so distances are approximate.'}</p>
        )}
        {unscored.length > 0 && <p className="mt-1 text-chalk-2">No recipe data for {unscored.join(', ')} yet. The panel shows its other evidence.</p>}
      </div>
    </div>
  );
}
