'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import atlas from '@/data/flavor-atlas.json';
import aromaData from '@/data/aroma-fingerprints.json';
import { useSelection } from '@/context/SelectionContext';
import { familyLabel } from '@/lib/colors';
import { spiceColor, luminance } from '@/lib/spice-colors';
import { THEME } from '@/lib/theme';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';
import type { SpiceProfile } from '@/types/spice';

type Point = { spice: SpiceProfile; x: number; y: number; r: number; hidden?: boolean };
type Edge = { source: string; target: string; score: number };
const coordinates = atlas.points as Record<string, { x: number; y: number }>;
// Always use the full atlas, never the current lens: cuisine/heat filters must not rearrange the map.
// Fit to the 4th–96th percentile so a few outliers (wasabi, hibiscus) don't shrink everyone else.
const allPoints = Object.values(coordinates);
const spread = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), at = (q: number) => sorted[Math.round(q * (sorted.length - 1))];
  return [at(0.04), at(0.96)];
};
const xExtent = spread(allPoints.map(p => p.x));
const yExtent = spread(allPoints.map(p => p.y));
/** Beyond the fitted range a value keeps moving outward, only more slowly, until it meets the canvas edge. */
const squash = (u: number) => (u < 0 ? u * 0.35 : u > 1 ? 1 + (u - 1) * 0.35 : u);

const TAU = Math.PI * 2;
/** Most partner lines drawn at once; every partner dot is still marked. */
const MAX_LINES = 10;
/** Atlas stretch limit: x and y may be scaled apart by this much to fill the canvas. */
const MAX_STRETCH = 1.6;
/** Extra clearance between neighbouring dots (px), sideways and vertically, so labels have room. */
const SPREAD_X = 26, SPREAD_Y = 8;

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

// ─── Shared label language (also used by FlavorMap2D) ───────────────────────
// selected = chalk-filled · partner = outlined · hover = raised · everything else quiet.

export type LabelTone = 'selected' | 'partner' | 'hover' | 'quiet' | 'dim';
export const LABEL_FONT = 11.5;
const CHAR_W = 6.4;
const GAP = 4;

export function labelSize(name: string, tone: LabelTone) {
  const pill = tone === 'selected' || tone === 'partner' || tone === 'hover';
  return { w: Math.ceil(name.length * CHAR_W) + (pill ? 12 : 6), h: pill ? 18 : 16 };
}

export function SpiceLabel({ name, x, y, w, h, tone }: { name: string; x: number; y: number; w: number; h: number; tone: LabelTone }) {
  const pill = tone === 'selected' || tone === 'partner' || tone === 'hover';
  return (
    <g className="atlas-label" pointerEvents="none" style={{ transform: `translate(${x}px, ${y}px)` }}>
      {pill && (
        <rect
          x={-w / 2} y={-h / 2} width={w} height={h} rx={5}
          fill={tone === 'selected' ? THEME.chalk : tone === 'hover' ? THEME.boardHigh : THEME.board}
          fillOpacity={tone === 'partner' ? 0.88 : 1}
          stroke={tone === 'selected' ? 'none' : THEME.chalk}
          strokeOpacity={tone === 'hover' ? 0.55 : 0.7}
        />
      )}
      <text
        y={0.5} textAnchor="middle" dominantBaseline="central" fontSize={LABEL_FONT}
        fontWeight={tone === 'selected' || tone === 'hover' ? 600 : 500}
        fill={tone === 'selected' ? THEME.board : tone === 'dim' ? THEME.chalk3 : tone === 'quiet' ? THEME.chalk2 : THEME.chalk}
        {...(pill ? {} : { stroke: THEME.board, strokeWidth: 3, strokeLinejoin: 'round' as const, paintOrder: 'stroke' })}
      >{name}</text>
    </g>
  );
}

type Box = { x0: number; y0: number; x1: number; y1: number };
export type LabelItem = { id: string; x: number; y: number; r: number; w: number; h: number; force: boolean };
export type LabelDot = { id: string; x: number; y: number; r: number };

const hitsBox = (a: Box, b: Box) => a.x0 < b.x1 + 2 && a.x1 + 2 > b.x0 && a.y0 < b.y1 + 2 && a.y1 + 2 > b.y0;
const hitsDot = (a: Box, d: LabelDot) => {
  const nx = Math.max(a.x0, Math.min(a.x1, d.x)), ny = Math.max(a.y0, Math.min(a.y1, d.y));
  return Math.hypot(nx - d.x, ny - d.y) < d.r + 1.5;
};

/** Where a label may sit around its dot: below, above, right, left, the four diagonals, then looser fallbacks. */
function labelAnchors(it: LabelItem, b: Box) {
  const { x, y, r, w, h } = it, k = r * 0.72;
  const fit = (cx: number) => (w >= b.x1 - b.x0 ? cx : Math.max(b.x0 + w / 2, Math.min(b.x1 - w / 2, cx)));
  return [
    { x: fit(x), y: y + r + GAP + h / 2 },
    { x: fit(x), y: y - r - GAP - h / 2 },
    { x: x + r + GAP + w / 2, y },
    { x: x - r - GAP - w / 2, y },
    { x: x + k + w / 2, y: y + k + GAP + h / 2 },
    { x: x - k - w / 2, y: y + k + GAP + h / 2 },
    { x: x + k + w / 2, y: y - k - GAP - h / 2 },
    { x: x - k - w / 2, y: y - k - GAP - h / 2 },
    // Last resorts: one label-height further out, or sliding along the dot.
    { x: fit(x), y: y + r + GAP + h * 1.5 },
    { x: fit(x), y: y - r - GAP - h * 1.5 },
    { x: x + r + GAP + w / 2, y: y + h },
    { x: x + r + GAP + w / 2, y: y - h },
    { x: x - r - GAP - w / 2, y: y + h },
    { x: x - r - GAP - w / 2, y: y - h },
  ];
}

/**
 * Greedy label placement. `items` arrive in priority order; each takes the first
 * anchor that clears earlier labels and every other dot. A forced item (selected,
 * partner) relaxes to ignoring dots, then to its first anchor, so it is never hidden.
 */
export function placeLabels(items: LabelItem[], dots: LabelDot[], bounds: Box, blocked: Box[] = []) {
  const placed = new Map<string, { x: number; y: number }>();
  const boxes = [...blocked];
  for (const it of items) {
    const options = labelAnchors(it, bounds)
      .map(c => ({ c, box: { x0: c.x - it.w / 2, y0: c.y - it.h / 2, x1: c.x + it.w / 2, y1: c.y + it.h / 2 } }))
      .filter(o => o.box.x0 >= bounds.x0 && o.box.x1 <= bounds.x1 && o.box.y0 >= bounds.y0 && o.box.y1 <= bounds.y1);
    const clearOfLabels = (o: (typeof options)[number]) => !boxes.some(b => hitsBox(o.box, b));
    const pick = options.find(o => clearOfLabels(o) && !dots.some(d => d.id !== it.id && hitsDot(o.box, d)))
      ?? (it.force ? options.find(clearOfLabels) ?? options[0] ?? { c: labelAnchors(it, bounds)[0], box: null } : undefined);
    if (!pick) continue;
    placed.set(it.id, pick.c);
    boxes.push(pick.box ?? { x0: pick.c.x - it.w / 2, y0: pick.c.y - it.h / 2, x1: pick.c.x + it.w / 2, y1: pick.c.y + it.h / 2 });
  }
  return placed;
}

const AROMA_WORDS: Record<string, string> = {
  woody: 'woody', citrus: 'citrus', floral: 'floral', 'sweet-balsamic': 'sweet', 'spicy-phenolic': 'spicy',
  'green-herbal': 'green', 'earthy-roasty': 'roasty', 'sulfurous-alliaceous': 'oniony', 'minty-camphor': 'minty',
  fruity: 'fruity', 'fatty-waxy': 'waxy', nutty: 'nutty',
};
const aroma = aromaData as unknown as Record<string, { vector: Record<string, number> | null }>;
/** Strongest measured aroma notes, for the one-line detail under the map. */
export function aromaWords(spice: { id: string; name: string }, count = 3): string[] {
  const tid = toTaxonomyId(spice.id, spice.name);
  const vector = tid ? aroma[tid]?.vector : null;
  if (!vector) return [];
  return Object.entries(vector).sort((a, b) => b[1] - a[1]).slice(0, count).map(([k]) => AROMA_WORDS[k] ?? k);
}

// ─── Focus layout helpers ───────────────────────────────────────────────────

const circDiff = (a: number, b: number) => ((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI;

/** An ellipse parameterised by arc length, so slots are evenly spaced on screen, not in angle. */
function makeRing(cx: number, cy: number, rx: number, ry: number) {
  const N = 360, cum = [0], phi = [0];
  let px = rx, py = 0;
  for (let k = 1; k <= N; k++) {
    const t = (k / N) * TAU, x = rx * Math.cos(t), y = ry * Math.sin(t);
    cum.push(cum[k - 1] + Math.hypot(x - px, y - py)); phi.push(Math.atan2(y, x)); px = x; py = y;
  }
  const total = cum[N] || 1;
  return {
    /** Arc fraction (0–1, clockwise from the right) where a ray from the centre at angle `a` meets the ring. */
    at(a: number) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < N; k++) { const d = Math.abs(circDiff(phi[k], a)); if (d < bestD) { bestD = d; best = k; } }
      return cum[best] / total;
    },
    point(f: number) {
      const target = (((f % 1) + 1) % 1) * total;
      let k = 0;
      while (k < N - 1 && cum[k + 1] < target) k++;
      const t = ((k + (target - cum[k]) / (cum[k + 1] - cum[k] || 1)) / N) * TAU;
      return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
    },
  };
}
const perimeter = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

export default function FlavorAtlas({ data, pairingFocus }: { data: SpiceProfile[]; pairingFocus: boolean }) {
  const { selectedSpiceIds, toggleSpice, hoveredSpiceId, setHovered } = useSelection();
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
  const { edges, owner, partners, unscored } = useMemo(() => {
    const all: Edge[] = [];
    const seen = new Set<string>();
    const partners = new Set<string>();
    const unscored: string[] = [];
    // Fewer partners per spice as the selection grows, so the ring stays readable.
    const perSpice = selected.length <= 2 ? 5 : selected.length <= 4 ? 4 : 3;
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
      // Rank locally; a fixed 0.5 cutoff passed nearly the entire dataset. Spices already chosen need no suggesting.
      const chosen = candidates.filter(c => !selectedSpiceIds.has(c.target)).slice(0, perSpice);
      for (const { target, score } of chosen) {
        const key = [spice.id, target].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key); partners.add(target);
        all.push({ source: spice.id, target, score });
      }
    }
    all.sort((a, b) => b.score - a.score);
    // Each partner belongs to the selected spice it pairs with best.
    const owner = new Map<string, string>();
    for (const e of all) if (!owner.has(e.target)) owner.set(e.target, e.source);
    return { edges: all.slice(0, MAX_LINES), owner, partners, unscored };
  }, [selected, selectedSpiceIds, data]);

  const nodes = useMemo(() => {
    const { width, height } = size;
    const padX = Math.min(44, width * .08), padTop = 30, padBottom = 30;
    const radiusOf = (s: SpiceProfile) => (focused ? 10 : 6.5) + s.intensity / 100 * 4;
    // Fit the atlas to the canvas; x and y may stretch apart, but only so far.
    const availW = Math.max(1, width - padX * 2), availH = Math.max(1, height - padTop - padBottom);
    const xSpan = (xExtent[1] - xExtent[0]) || 1, ySpan = (yExtent[1] - yExtent[0]) || 1;
    let fx = availW * .92 / xSpan, fy = availH * .92 / ySpan;
    if (fx > fy * MAX_STRETCH) fx = fy * MAX_STRETCH; else if (fy > fx * MAX_STRETCH) fy = fx * MAX_STRETCH;
    const home = (id: string) => {
      const p = coordinates[id];
      if (!p) return null;
      const ux = squash((p.x - xExtent[0]) / xSpan) - .5, uy = squash((p.y - yExtent[0]) / ySpan) - .5;
      return {
        x: Math.max(padX, Math.min(width - padX, width / 2 + ux * xSpan * fx)),
        y: Math.max(padTop, Math.min(height - padBottom, padTop + availH / 2 - uy * ySpan * fy)),
      };
    };
    const shown = focused ? data.filter(s => selectedSpiceIds.has(s.id) || partners.has(s.id)) : data;
    const points: Point[] = [];
    if (focused) {
      const cx = width / 2, cy = height / 2;
      const rxOut = Math.max(40, width / 2 - padX - 16), ryOut = Math.max(40, height / 2 - padTop - 14);
      const n = selected.length;
      const slot = new Map<string, { x: number; y: number }>();
      if (n === 1) slot.set(selected[0].id, { x: cx, y: cy });
      else {
        // Selected spices share a small inner ring sized to the count, in atlas order so neighbours stay neighbours.
        const mean = selected.reduce((m, s) => ({ x: m.x + (coordinates[s.id]?.x ?? 0) / n, y: m.y + (coordinates[s.id]?.y ?? 0) / n }), { x: 0, y: 0 });
        const ordered = [...selected].sort((a, b) => {
          const angle = (s: SpiceProfile) => Math.atan2(-((coordinates[s.id]?.y ?? 0) - mean.y), (coordinates[s.id]?.x ?? 0) - mean.x);
          return angle(a) - angle(b);
        });
        let k = Math.min(.5, .2 + .035 * (n - 1));
        while (k < .56 && perimeter(rxOut * k, ryOut * k) < n * 92) k += .02;
        const inner = makeRing(cx, cy, rxOut * k, ryOut * k);
        const start = n === 2 ? 0 : .75;
        ordered.forEach((s, i) => slot.set(s.id, inner.point(start + i / n)));
      }
      for (const s of selected) { const p = slot.get(s.id)!; points.push({ spice: s, x: p.x, y: p.y, r: radiusOf(s) }); }
      // Partners sit on the outer ring, each as close as an even spread allows to the spice it pairs with best.
      const outer = shown.filter(s => !selectedSpiceIds.has(s.id));
      const ring = makeRing(cx, cy, rxOut, ryOut);
      const want = outer.map(s => {
        const own = slot.get(owner.get(s.id) ?? '') ?? { x: cx, y: cy };
        const from = coordinates[owner.get(s.id) ?? ''], to = coordinates[s.id];
        const rel = from && to ? Math.atan2(-(to.y - from.y), to.x - from.x) : 0;
        const a = n === 1 ? rel : Math.atan2(own.y - cy, own.x - cx) + .02 * rel / Math.PI;
        return { spice: s, f: ring.at(a) };
      }).sort((a, b) => a.f - b.f);
      const m = want.length;
      let off = 0, best = Infinity;
      for (let step = 0; step < 360 && m; step++) {
        const o = step / 360;
        let cost = 0;
        for (let i = 0; i < m; i++) { const d = ((want[i].f - o - i / m + .5) % 1 + 1) % 1 - .5; cost += d * d; }
        if (cost < best) { best = cost; off = o; }
      }
      want.forEach(({ spice }, i) => { const p = ring.point(off + i / m); points.push({ spice, x: p.x, y: p.y, r: radiusOf(spice) }); });
    } else {
      shown.forEach(spice => {
        const p = home(spice.id);
        if (p) points.push({ spice, x: p.x, y: p.y, r: radiusOf(spice) });
      });
      // Small deterministic displacement keeps almost identical profiles pickable.
      // Full flavor coordinates stay fixed; only the marks separate on screen.
      for (let iteration = 0; iteration < 40; iteration++) {
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (distance < .01) { dx = Math.cos(i + j); dy = Math.sin(i + j); }
          // Keep clear room for a label beside each dot: an ellipse, wider than tall.
          const norm = Math.hypot(dx, dy), rr = a.r + b.r, gap = 1 / Math.hypot(dx / norm / (rr + SPREAD_X), dy / norm / (rr + SPREAD_Y));
          if (distance >= gap) continue;
          const shift = (gap - distance) / 2;
          a.x -= dx / norm * shift; a.y -= dy / norm * shift;
          b.x += dx / norm * shift; b.y += dy / norm * shift;
        }
        for (const p of points) { p.x = Math.max(p.r + 4, Math.min(width - p.r - 4, p.x)); p.y = Math.max(p.r + 4, Math.min(height - p.r - 4, p.y)); }
      }
    }
    // Retain SVG marks so layout changes interpolate in both directions.
    if (focused) {
      for (const spice of data) {
        if (selectedSpiceIds.has(spice.id) || partners.has(spice.id)) continue;
        const p = home(spice.id);
        if (p) points.push({ spice, x: p.x, y: p.y, r: radiusOf(spice), hidden: true });
      }
    }
    return points;
  }, [data, size, focused, partners, owner, selected, selectedSpiceIds]);
  const byId = new Map(nodes.map(p => [p.spice.id, p]));
  const hasSelection = selected.length > 0;
  const hovered = hoveredSpiceId ? byId.get(hoveredSpiceId) : undefined;
  const detail = hoveredSpiceId ? data.find(s => s.id === hoveredSpiceId) : undefined;
  const directions = useMemo(() => describeDirections(data), [data]);
  const showSides = size.width >= 560;

  const toneOf = (id: string): LabelTone => (selectedSpiceIds.has(id) ? 'selected' : partners.has(id) ? 'partner' : hasSelection ? 'dim' : 'quiet');
  // Labels are laid out without hover, so the map stays still while the pointer moves.
  const labels = useMemo(() => {
    const visible = nodes.filter(p => !p.hidden);
    const rank = (id: string) => (selectedSpiceIds.has(id) ? 0 : partners.has(id) ? 1 : 2);
    const items: LabelItem[] = [...visible]
      .sort((a, b) => rank(a.spice.id) - rank(b.spice.id) || b.spice.commonality - a.spice.commonality || a.spice.name.localeCompare(b.spice.name))
      .map(p => {
        const tone: LabelTone = selectedSpiceIds.has(p.spice.id) ? 'selected' : partners.has(p.spice.id) ? 'partner' : 'quiet';
        return { id: p.spice.id, x: p.x, y: p.y, r: p.r, ...labelSize(p.spice.name, tone), force: tone !== 'quiet' };
      });
    // The faint direction words along the edges are obstacles too.
    const { width, height } = size;
    const side = (text: string, cx: number, anchor: 'start' | 'middle' | 'end', y: number): Box => {
      const w = text.length * 6.2 + 12, x0 = anchor === 'middle' ? cx - w / 2 : anchor === 'start' ? cx : cx - w;
      return { x0, x1: x0 + w, y0: y - 8, y1: y + 6 };
    };
    const blocked: Box[] = [];
    if (!focused) {
      if (directions.y.high) blocked.push(side(directions.y.high, width / 2, 'middle', 14));
      if (directions.y.low) blocked.push(side(directions.y.low, width / 2, 'middle', height - 6));
      if (showSides && directions.x.low) blocked.push(side(directions.x.low, 6, 'start', height - 6));
      if (showSides && directions.x.high) blocked.push(side(directions.x.high, width - 6, 'end', height - 6));
    }
    return placeLabels(items, visible.map(p => ({ id: p.spice.id, x: p.x, y: p.y, r: p.r })), { x0: 2, y0: 2, x1: width - 2, y1: height - 2 }, blocked);
  }, [nodes, selectedSpiceIds, partners, size, focused, directions, showSides]);

  const hoverLabel = hovered && !hovered.hidden ? (() => {
    const tone: LabelTone = selectedSpiceIds.has(hovered.spice.id) ? 'selected' : 'hover';
    const { w, h } = labelSize(hovered.spice.name, tone);
    const at = labels.get(hovered.spice.id) ?? {
      x: Math.max(w / 2 + 2, Math.min(size.width - w / 2 - 2, hovered.x)),
      y: Math.min(size.height - h / 2 - 2, hovered.y + hovered.r + 4 + h / 2),
    };
    return { ...at, w, h, tone };
  })() : null;

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-3 pt-1 md:px-6">
      <div ref={plotRef} className="relative min-h-0 flex-1 overflow-hidden">
        {nodes.length === 0 ? <div className="flex h-full items-center justify-center p-6 text-center text-body text-chalk-3">No spices match these filters.</div> : (
          <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={focused ? 'Selected spices and their top recipe partners' : 'Flavor atlas. Select a spice to explore pairings'}>
            <title>{focused ? 'Recipe pairing neighborhood' : 'Flavor atlas'}</title>
            <defs>
              <filter id="atlas-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.45" />
              </filter>
              <radialGradient id="atlas-sheen" cx="35%" cy="30%" r="65%">
                <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
                <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g pointerEvents="none" fill={THEME.chalk3} fontSize="12" style={{ opacity: focused ? 0 : 1, transition: 'opacity 400ms ease' }}>
              {directions.y.high && <text x={size.width / 2} y={14} textAnchor="middle">↑ {directions.y.high}</text>}
              {directions.y.low && <text x={size.width / 2} y={size.height - 6} textAnchor="middle">↓ {directions.y.low}</text>}
              {showSides && directions.x.low && <text x={6} y={size.height - 6}>← {directions.x.low}</text>}
              {showSides && directions.x.high && <text x={size.width - 6} y={size.height - 6} textAnchor="end">{directions.x.high} →</text>}
            </g>
            {/* Lines fade in once the spices have travelled to their places. */}
            <g key={edges.map(e => e.source + e.target).join('|') + (focused ? 'f' : 'a')} className="atlas-edges">
              {edges.map(e => {
                const a = byId.get(e.source), b = byId.get(e.target);
                if (!a || !b || a.hidden || b.hidden) return null;
                // Curved, tinted by the chosen spice, bowing away from the centre.
                const cx = size.width / 2, cy = size.height / 2;
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                const ox = mx - cx, oy = my - cy, ol = Math.hypot(ox, oy) || 1;
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                const qx = mx + (ox / ol) * len * 0.18, qy = my + (oy / ol) * len * 0.18;
                const trim = (px: number, py: number, tx: number, ty: number, r: number) => { const d = Math.hypot(tx - px, ty - py) || 1; return [px + ((tx - px) / d) * r, py + ((ty - py) / d) * r]; };
                const [sx, sy] = trim(a.x, a.y, qx, qy, a.r + 3), [ex, ey] = trim(b.x, b.y, qx, qy, b.r + 3);
                const tint = spiceColor(a.spice.id, a.spice.name, a.spice.family);
                const rank = Math.max(0, Math.min(1, (e.score - 0.5) / 0.45));
                return <path key={[e.source, e.target].sort().join('|')} d={`M${sx},${sy} Q${qx},${qy} ${ex},${ey}`} fill="none" stroke={luminance(tint) < 0.05 ? THEME.chalk2 : tint} strokeWidth={1.2 + rank * 1.8} strokeLinecap="round" opacity={0.4 + rank * 0.5}><title>{a.spice.name} + {b.spice.name}: recipe affinity {e.score.toFixed(2)}</title></path>;
              })}
            </g>
            {nodes.map(p => {
              const isSelected = selectedSpiceIds.has(p.spice.id), isPartner = partners.has(p.spice.id);
              const color = spiceColor(p.spice.id, p.spice.name, p.spice.family);
              const dim = hasSelection && !isSelected && !isPartner;
              return (
                <g key={p.spice.id} data-spice-id={p.spice.id} className="atlas-node" aria-hidden={p.hidden || undefined} style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity: p.hidden ? 0 : 1, pointerEvents: p.hidden ? 'none' : undefined }}>
                  <circle className="atlas-ring" r={p.r + 5} fill="none" stroke={THEME.chalk} strokeWidth={isSelected ? 2.2 : 1.2} style={{ opacity: isSelected ? 0.95 : isPartner ? 0.5 : 0 }} />
                  <g className="atlas-dot" filter="url(#atlas-shadow)" style={{ opacity: dim ? 0.4 : 1, transition: 'transform 180ms var(--ease-out-soft), opacity 220ms ease' }}>
                    <circle r={p.r} fill={color} stroke={luminance(color) < 0.05 ? 'rgba(243,239,232,0.5)' : 'rgba(0,0,0,0.25)'} strokeWidth="1" />
                    <circle r={p.r} fill="url(#atlas-sheen)" />
                  </g>
                  <circle r={Math.max(p.r + 6, 14)} fill="transparent" role="button" tabIndex={p.hidden ? -1 : 0} aria-label={`${p.spice.name}, ${familyLabel(p.spice.family)}. ${isSelected ? 'Remove from' : 'Add to'} selection.`} aria-pressed={isSelected} onClick={() => toggleSpice(p.spice.id)} onPointerEnter={() => setHovered(p.spice.id)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(p.spice.id)} onBlur={() => setHovered(null)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleSpice(p.spice.id); } }} className="cursor-pointer outline-none" />
                </g>
              );
            })}
            {nodes.map(p => {
              const at = labels.get(p.spice.id);
              if (!at || p.spice.id === hovered?.spice.id) return null;
              const tone = toneOf(p.spice.id);
              return <SpiceLabel key={`label-${p.spice.id}`} name={p.spice.name} x={at.x} y={at.y} tone={tone} {...labelSize(p.spice.name, tone === 'dim' ? 'quiet' : tone)} />;
            })}
            {/* The hovered spice, wherever the pointer came from, is raised above everything else. */}
            {hovered && !hovered.hidden && hoverLabel && (
              <g pointerEvents="none">
                <g transform={`translate(${hovered.x} ${hovered.y})`}>
                  <circle r={hovered.r + 5} fill="none" stroke={THEME.chalk} strokeWidth={1.8} opacity={0.9} />
                  <circle r={hovered.r * 1.12} fill={spiceColor(hovered.spice.id, hovered.spice.name, hovered.spice.family)} stroke="rgba(243,239,232,0.6)" strokeWidth="1" />
                </g>
                <SpiceLabel name={hovered.spice.name} x={hoverLabel.x} y={hoverLabel.y} w={hoverLabel.w} h={hoverLabel.h} tone={hoverLabel.tone} />
              </g>
            )}
          </svg>
        )}
      </div>
      <div className="mt-2 flex min-h-8 shrink-0 items-baseline justify-between gap-4 border-t border-rule pt-2 text-small leading-snug text-chalk-3">
        <p className="min-w-0 truncate">
          {detail && (
            <>
              <span className="font-display text-lead text-chalk">{detail.name}</span>
              <span className="ml-2">{[familyLabel(detail.family), ...aromaWords(detail)].join(' · ')}</span>
            </>
          )}
        </p>
        {unscored.length > 0 && <p className="shrink-0 text-chalk-2">No recipe data for {unscored.join(', ')}</p>}
      </div>
    </div>
  );
}
