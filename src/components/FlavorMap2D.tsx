'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { FAMILY_COLORS } from '@/lib/colors';
import { useSelection } from '@/context/SelectionContext';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';

// Affinity-edge tuning
const EDGE_TOP_N = 6; // strongest partners drawn per selected spice
const EDGE_MIN_SCORE = 0.5; // FlavorGraph cosine midpoint — below this isn't a signal

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
  map_x: number | null;
  map_y: number | null;
  description: string | null;
}

type AxisKey = 'warmth' | 'brightness' | 'earthiness' | 'florality' | 'heat';

interface FlavorMap2DProps {
  data: SpiceData[];
}

const AXES: { key: AxisKey; label: string }[] = [
  { key: 'warmth', label: 'Warmth' },
  { key: 'brightness', label: 'Brightness' },
  { key: 'earthiness', label: 'Earthiness' },
  { key: 'florality', label: 'Florality' },
  { key: 'heat', label: 'Heat' },
];

export default function FlavorMap2D({ data }: FlavorMap2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [xAxis, setXAxis] = useState<AxisKey>('warmth');
  const [yAxis, setYAxis] = useState<AxisKey>('brightness');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const { selectedSpiceIds, toggleSpice } = useSelection();

  const MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };
  const WIDTH = 800;
  const HEIGHT = 600;
  const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Filter data to only spices with all necessary values
  const validData = useMemo(() => {
    return data.filter(
      (d) => d[xAxis] != null && d[yAxis] != null && d.intensity != null
    );
  }, [data, xAxis, yAxis]);

  // Compute scales
  const { xScale, yScale, sizeScale } = useMemo(() => {
    const xMin = Math.min(...validData.map((d) => d[xAxis] as number));
    const xMax = Math.max(...validData.map((d) => d[xAxis] as number));
    const yMin = Math.min(...validData.map((d) => d[yAxis] as number));
    const yMax = Math.max(...validData.map((d) => d[yAxis] as number));

    const xScale = d3
      .scaleLinear()
      .domain([xMin - 5, xMax + 5])
      .range([0, INNER_WIDTH]);

    const yScale = d3
      .scaleLinear()
      .domain([yMin - 5, yMax + 5])
      .range([INNER_HEIGHT, 0]);

    const sizeScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([3, 12]);

    return { xScale, yScale, sizeScale };
  }, [validData, xAxis, yAxis]);

  // Compute glowing affinity edges from each selected spice to its strongest
  // FlavorGraph partners. Edges are deduplicated across selected spices, and
  // the set of connected partners is tracked so we can emphasize them.
  const { edges, connectedIds } = useMemo(() => {
    if (selectedSpiceIds.size === 0 || !showEdges) {
      return { edges: [] as { source: string; target: string; score: number }[], connectedIds: new Set<string>() };
    }

    // Resolve every plotted spice to its taxonomy id once.
    const tidBySlug = new Map<string, string>();
    for (const d of validData) {
      const tid = toTaxonomyId(d.id, d.name);
      if (tid) tidBySlug.set(d.id, tid);
    }

    const seen = new Set<string>();
    const edges: { source: string; target: string; score: number }[] = [];
    const connectedIds = new Set<string>();

    for (const selId of selectedSpiceIds) {
      const selTid = tidBySlug.get(selId);
      if (!selTid) continue;

      const partners: { target: string; score: number }[] = [];
      for (const d of validData) {
        if (d.id === selId) continue;
        const tid = tidBySlug.get(d.id);
        if (!tid) continue;
        const score = getAffinity(selTid, tid);
        if (score !== null && score >= EDGE_MIN_SCORE) {
          partners.push({ target: d.id, score });
        }
      }
      partners.sort((a, b) => b.score - a.score);

      for (const { target, score } of partners.slice(0, EDGE_TOP_N)) {
        const key = selId < target ? `${selId}|${target}` : `${target}|${selId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ source: selId, target, score });
        connectedIds.add(target);
      }
    }

    return { edges, connectedIds };
  }, [validData, selectedSpiceIds, showEdges]);

  // Render SVG
  useEffect(() => {
    if (!svgRef.current || validData.length === 0) return;

    const svg = d3.select(svgRef.current);

    // Clear previous content except axes labels
    svg.selectAll('.edge-group').remove();
    svg.selectAll('.dot-group').remove();
    svg.selectAll('.axis-label').remove();

    // Node center in SVG coords (shared by edges + dots)
    const cx = (d: SpiceData) => MARGIN.left + xScale(d[xAxis] as number);
    const cy = (d: SpiceData) => MARGIN.top + yScale(d[yAxis] as number);
    const posById = new Map(validData.map((d) => [d.id, { x: cx(d), y: cy(d) }]));

    // Affinity edges render UNDER the dots.
    type Edge = (typeof edges)[number];
    const edgeG = svg.append('g').attr('class', 'edge-group');
    edgeG
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('x1', (e: Edge) => posById.get(e.source)?.x ?? 0)
      .attr('y1', (e: Edge) => posById.get(e.source)?.y ?? 0)
      .attr('x2', (e: Edge) => posById.get(e.target)?.x ?? 0)
      .attr('y2', (e: Edge) => posById.get(e.target)?.y ?? 0)
      .attr('stroke', '#22d3ee')
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', (e: Edge) => 1 + ((e.score - EDGE_MIN_SCORE) / (1 - EDGE_MIN_SCORE)) * 3.5)
      .attr('stroke-opacity', (e: Edge) => 0.2 + ((e.score - EDGE_MIN_SCORE) / (1 - EDGE_MIN_SCORE)) * 0.65)
      .attr('filter', 'url(#edge-glow)')
      .attr('class', 'affinity-edge');

    // Create main group for dots
    const g = svg.append('g').attr('class', 'dot-group');

    // Bind data and create circles
    g.selectAll('circle')
      .data(validData, (d: any) => d.id)
      .join(
        (enter: any) =>
          enter
            .append('circle')
            .attr('cx', (d: any) => MARGIN.left + xScale(d[xAxis] as number))
            .attr('cy', (d: any) => MARGIN.top + yScale(d[yAxis] as number))
            .attr('r', (d: any) => sizeScale(d.intensity || 0))
            .attr('fill', (d: any) => FAMILY_COLORS[d.family] || '#90caf9')
            .attr('opacity', (d: any) => {
              const base = 0.6 + (d.commonality || 0) / 300;
              if (selectedSpiceIds.size > 0 && !selectedSpiceIds.has(d.id)) {
                return connectedIds.has(d.id) ? base : base * 0.35;
              }
              return base;
            })
            .attr('stroke', (d: any) =>
              selectedSpiceIds.has(d.id)
                ? '#ffffff'
                : connectedIds.has(d.id)
                ? '#22d3ee'
                : 'none'
            )
            .attr('stroke-width', 2)
            .attr('class', 'cursor-pointer transition-all duration-200'),
        (update: any) =>
          update
            .attr('opacity', (d: any) => {
              const base = 0.6 + (d.commonality || 0) / 300;
              if (selectedSpiceIds.size > 0 && !selectedSpiceIds.has(d.id)) {
                return connectedIds.has(d.id) ? base : base * 0.35;
              }
              return base;
            })
            .attr('stroke', (d: any) =>
              selectedSpiceIds.has(d.id)
                ? '#ffffff'
                : connectedIds.has(d.id)
                ? '#22d3ee'
                : 'none'
            ),
        (exit: any) => exit.remove()
      )
      .on('click', (e: any, d: SpiceData) => {
        e.stopPropagation();
        toggleSpice(d.id);
      })
      .on('mouseenter', (e: any, d: SpiceData) => {
        e.currentTarget.setAttribute('r', String(sizeScale(d.intensity || 0) * 1.5));
        e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(255,255,255,0.5))';
        setHoveredId(d.id);
      })
      .on('mouseleave', (e: any, d: SpiceData) => {
        e.currentTarget.setAttribute('r', String(sizeScale(d.intensity || 0)));
        e.currentTarget.style.filter = 'none';
        setHoveredId(null);
      });

    // Add axis labels
    svg
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', MARGIN.left + INNER_WIDTH / 2)
      .attr('y', HEIGHT - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('opacity', 0.7)
      .text(AXES.find((a) => a.key === xAxis)?.label || '');

    svg
      .append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', 8)
      .attr('x', -(MARGIN.top + INNER_HEIGHT / 2))
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('opacity', 0.7)
      .text(AXES.find((a) => a.key === yAxis)?.label || '');
  }, [validData, xAxis, yAxis, selectedSpiceIds, xScale, yScale, sizeScale, edges, connectedIds]);

  return (
    <div className="w-full h-full flex flex-col gap-6 bg-neutral-950 rounded-xl overflow-hidden border border-white/10 shadow-2xl p-6 max-md:p-3">
      {/* Header — left padding clears the fixed hamburger button */}
      <div className="space-y-2 pl-12">
        <h2 className="text-2xl font-light tracking-tight text-white">
          Flavor Space Map
        </h2>
        <p className="text-white/60 text-sm max-w-sm">
          Explore spices by their flavor profile. Dot size represents intensity;
          proximity indicates flavor similarity.
        </p>
      </div>

      {/* Axis Toggles */}
      <div className="flex gap-6 items-center flex-wrap">
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-widest text-white/50">
            X Axis
          </label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value as AxisKey)}
            className="px-3 py-1 bg-white/5 border border-white/20 rounded text-sm text-white hover:bg-white/10 transition-colors"
          >
            {AXES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-widest text-white/50">
            Y Axis
          </label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value as AxisKey)}
            className="px-3 py-1 bg-white/5 border border-white/20 rounded text-sm text-white hover:bg-white/10 transition-colors"
          >
            {AXES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 ml-auto">
          <label className="text-xs uppercase tracking-widest text-white/50">
            Pairing Edges
          </label>
          <button
            type="button"
            onClick={() => setShowEdges((v) => !v)}
            aria-pressed={showEdges}
            className={`px-3 py-1 rounded text-sm border transition-colors ${
              showEdges
                ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10'
            }`}
          >
            {showEdges ? 'Affinity on' : 'Affinity off'}
          </button>
        </div>
      </div>

      {selectedSpiceIds.size > 0 && showEdges && (
        <p className="text-xs text-cyan-300/80 -mt-2">
          <span className="inline-block w-6 h-[2px] align-middle mr-1.5 rounded bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          Glowing lines = FlavorGraph recipe affinity · brighter, thicker ={' '}
          stronger pairing
          {edges.length > 0 ? ` (${edges.length} shown)` : ''}
        </p>
      )}

      {/* SVG Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          className="bg-black/30 rounded-lg"
        >
          {/* Grid lines + edge glow */}
          <defs>
            <pattern
              id="grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
                opacity="0.1"
              />
            </pattern>
            <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={INNER_WIDTH}
            height={INNER_HEIGHT}
            fill="url(#grid)"
          />

          {/* Axes */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top + INNER_HEIGHT}
            x2={MARGIN.left + INNER_WIDTH}
            y2={MARGIN.top + INNER_HEIGHT}
            stroke="white"
            strokeWidth="1"
            opacity="0.3"
          />
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={MARGIN.top + INNER_HEIGHT}
            stroke="white"
            strokeWidth="1"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* Hover Tooltip */}
      {hoveredId && (
        <div className="text-xs text-white/70 space-y-1 bg-white/5 p-3 rounded border border-white/10">
          {(() => {
            const d = validData.find((x) => x.id === hoveredId);
            if (!d) return null;
            return (
              <>
                <div className="font-semibold text-white">{d.name}</div>
                <div className="text-white/60">{d.family}</div>
                {d.description && (
                  <div className="text-white/50 italic">{d.description}</div>
                )}
                <div className="pt-2 space-y-1 text-white/60 text-xs">
                  <div>Warmth: {d.warmth}</div>
                  <div>Brightness: {d.brightness}</div>
                  <div>Earthiness: {d.earthiness}</div>
                  <div>Florality: {d.florality}</div>
                  <div>Heat: {d.heat}</div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
