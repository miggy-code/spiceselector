'use client';

import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { FAMILY_COLORS } from '@/lib/colors';
import { useSelection } from '@/context/SelectionContext';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';

// Affinity-edge tuning (mirrors FlavorMap2D)
const EDGE_TOP_N = 6;
const EDGE_MIN_SCORE = 0.5;

interface Pairing {
  spice: string;
  affinity: 'classic' | 'complementary' | 'surprising';
  note: string;
}

interface Cuisine {
  cuisine: string;
  frequency: string;
}

interface SpiceNode {
  id: string;
  name: string;
  family: string;
  description: string | null;
  warmth: number;
  brightness: number;
  earthiness: number;
  florality: number;
  heat: number;
  intensity: number;
  commonality: number;
  origin: string | null;
  heat_level: string | null;
  key_compounds: string[];
  top_pairings: Pairing[];
  cuisines: Cuisine[];
}

type FlavorDim = 'warmth' | 'brightness' | 'earthiness' | 'florality' | 'heat';

const DIMS: { key: FlavorDim; label: string }[] = [
  { key: 'warmth', label: 'Warmth' },
  { key: 'brightness', label: 'Brightness' },
  { key: 'earthiness', label: 'Earthiness' },
  { key: 'florality', label: 'Florality' },
  { key: 'heat', label: 'Heat' },
];

function toCoord(value: number): number {
  return (value - 50) / 10;
}

const AFFINITY_COLORS: Record<string, string> = {
  classic: '#ffc107',
  complementary: '#64b5f6',
  surprising: '#ce93d8',
};

const HEAT_DOTS: Record<string, number> = {
  mild: 1,
  medium: 2,
  hot: 3,
  extreme: 4,
};

// ─── Axis guides ─────────────────────────────────────────────────────────────

const AxisGuides = ({ xLabel, yLabel, zLabel }: { xLabel: string; yLabel: string; zLabel: string }) => {
  const R = 5.5;

  const axisConfig = [
    {
      points: [[-R, 0, 0], [R, 0, 0]] as [number, number, number][],
      color: '#ff6b6b',
      labelPos: [R + 0.6, 0, 0] as [number, number, number],
      lowPos: [-R - 0.6, 0, 0] as [number, number, number],
      label: xLabel,
      textColor: 'text-red-400',
    },
    {
      points: [[0, -R, 0], [0, R, 0]] as [number, number, number][],
      color: '#6bffa0',
      labelPos: [0, R + 0.6, 0] as [number, number, number],
      lowPos: [0, -R - 0.6, 0] as [number, number, number],
      label: yLabel,
      textColor: 'text-emerald-400',
    },
    {
      points: [[0, 0, -R], [0, 0, R]] as [number, number, number][],
      color: '#6ba8ff',
      labelPos: [0, 0, R + 0.6] as [number, number, number],
      lowPos: [0, 0, -R - 0.6] as [number, number, number],
      label: zLabel,
      textColor: 'text-blue-400',
    },
  ];

  return (
    <group>
      {axisConfig.map(({ points, color, labelPos, lowPos, label, textColor }) => (
        <group key={label}>
          <Line points={points} color={color} lineWidth={1} opacity={0.35} transparent />

          {/* High end — label + direction */}
          <Html position={labelPos} center className="pointer-events-none select-none">
            <div className={`flex flex-col items-center gap-0.5 ${textColor}`}>
              <span className="text-[11px] font-semibold tracking-widest uppercase opacity-80">{label}</span>
              <span className="text-[9px] opacity-40 tracking-widest">HIGH</span>
            </div>
          </Html>

          {/* Low end */}
          <Html position={lowPos} center className="pointer-events-none select-none">
            <span className={`text-[9px] tracking-widest opacity-35 ${textColor}`}>LOW</span>
          </Html>
        </group>
      ))}

      {/* Tick marks every 2 units */}
      {[-4, -2, 0, 2, 4].map((t) => (
        <group key={t}>
          <Line points={[[t, -0.12, 0], [t, 0.12, 0]]} color="#ff6b6b" lineWidth={0.6} opacity={0.2} transparent />
          <Line points={[[0, t, -0.12], [0, t, 0.12]]} color="#6bffa0" lineWidth={0.6} opacity={0.2} transparent />
          <Line points={[[-0.12, 0, t], [0.12, 0, t]]} color="#6ba8ff" lineWidth={0.6} opacity={0.2} transparent />
        </group>
      ))}

      {/* Origin marker */}
      <mesh>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#ffffff" opacity={0.2} transparent />
      </mesh>
    </group>
  );
};

// ─── Floor grid ───────────────────────────────────────────────────────────────

const FloorGrid = () => (
  <primitive
    object={new THREE.GridHelper(11, 11, '#222222', '#181818')}
    position={[0, -5.2, 0]}
  />
);

// ─── Spice dot ────────────────────────────────────────────────────────────────

interface SpiceDotProps {
  spice: SpiceNode;
  position: [number, number, number];
  radius: number;
  color: string;
  emissiveIntensity: number;
  isSelected: boolean;
  isDimmed: boolean;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  onSelect: () => void;
}

const SpiceDot = ({
  spice, position, radius, color, emissiveIntensity,
  isSelected, isDimmed, hovered, setHovered, onSelect,
}: SpiceDotProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isHovered = hovered === spice.id;

  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.position.y = Math.sin(t * 1.5 + position[0] * 2.3) * 0.06;
      const targetScale = isHovered ? 1.6 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    }
  });

  const opacity = isDimmed ? 0.1 : isHovered || isSelected ? 1.0 : 0.88;
  const emissiveColor =
    isHovered || isSelected
      ? spice.heat_level === 'hot' || spice.heat_level === 'extreme'
        ? new THREE.Color('#ff4400')
        : threeColor
      : threeColor;
  const emissiveInt = isDimmed ? 0 : isHovered ? 0.9 : emissiveIntensity;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(spice.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveInt}
          roughness={0.3}
          metalness={0.6}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Drop line to floor for depth perception */}
      {!isDimmed && (
        <Line
          points={[[0, 0, 0], [0, -5.2 - position[1], 0]]}
          color={color}
          lineWidth={0.4}
          opacity={isHovered ? 0.35 : 0.1}
          transparent
        />
      )}

      {/* Name label — scales with camera distance so it stays readable at any zoom */}
      <Html
        position={[0, -radius - 0.28, 0]}
        center
        distanceFactor={12}
        zIndexRange={[50, 0]}
        className="pointer-events-none select-none"
      >
        <div className={`flex items-center gap-1 px-1.5 py-[3px] rounded-full transition-all duration-150 ${
          isHovered
            ? 'bg-black/80 border border-white/25 shadow-md'
            : isDimmed
            ? 'opacity-15'
            : 'bg-black/50'
        }`}>
          <div
            className="w-[5px] h-[5px] rounded-full flex-shrink-0"
            style={{ backgroundColor: color, opacity: isDimmed ? 0.3 : 1 }}
          />
          <span className={`text-[12px] whitespace-nowrap font-medium leading-none ${
            isHovered
              ? 'text-white'
              : isDimmed
              ? 'text-white/25'
              : 'text-white/85'
          }`}>
            {spice.name}
          </span>
        </div>
      </Html>

      {/* Rich hover tooltip */}
      {isHovered && (
        <Html position={[0, radius + 0.6, 0]} center zIndexRange={[100, 51]}>
          <div className="bg-black/92 backdrop-blur-md text-white px-4 py-3 rounded-xl border border-white/15 shadow-2xl w-[248px] pointer-events-none">
            <h3 className="font-bold text-[15px] bg-gradient-to-r from-amber-200 to-orange-400 bg-clip-text text-transparent leading-tight mb-1">
              {spice.name}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] uppercase tracking-widest text-white/50">{spice.family}</span>
              {spice.origin && (
                <span className="text-[11px] text-white/30">· {spice.origin.split(',')[0].trim()}</span>
              )}
            </div>

            {spice.heat_level && (
              <div className="flex items-center gap-1 mb-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < (HEAT_DOTS[spice.heat_level!] || 0) ? 'bg-orange-400' : 'bg-white/10'
                    }`}
                  />
                ))}
                <span className="text-[10px] text-white/40 ml-1 capitalize">{spice.heat_level}</span>
              </div>
            )}

            {spice.description && (
              <p className="text-[11px] text-white/55 leading-snug mb-2.5 line-clamp-2">{spice.description}</p>
            )}

            {spice.key_compounds.length > 0 && (
              <div className="mb-2.5">
                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Key Compounds</div>
                <div className="flex flex-wrap gap-1">
                  {spice.key_compounds.slice(0, 4).map((c, i) => (
                    <span key={i} className="text-[10px] bg-white/8 border border-white/10 px-1.5 py-0.5 rounded text-white/65">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {spice.top_pairings.length > 0 && (
              <div className="mb-2.5">
                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Pairs With</div>
                <div className="space-y-1">
                  {spice.top_pairings.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: AFFINITY_COLORS[p.affinity] || '#888' }}
                      />
                      <span className="text-[11px] text-white/75">{p.spice}</span>
                      <span className="text-[9px] text-white/30 capitalize ml-auto">{p.affinity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {spice.cuisines.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Cuisines</div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {spice.cuisines.slice(0, 3).map((c, i) => (
                    <span key={i} className="text-[11px] text-white/55">{c.cuisine}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

// ─── Affinity edges ─────────────────────────────────────────────────────────

interface EdgeNode {
  id: string;
  position: [number, number, number];
}

const AffinityEdges3D = ({ nodes }: { nodes: EdgeNode[] }) => {
  const { selectedSpiceIds } = useSelection();

  const edges = useMemo(() => {
    if (selectedSpiceIds.size === 0) return [];

    const tidById = new Map<string, string>();
    const posById = new Map<string, [number, number, number]>();
    for (const n of nodes) {
      const tid = toTaxonomyId(n.id);
      if (tid) tidById.set(n.id, tid);
      posById.set(n.id, n.position);
    }

    const seen = new Set<string>();
    const out: { points: [number, number, number][]; score: number }[] = [];

    for (const selId of selectedSpiceIds) {
      const selTid = tidById.get(selId);
      const selPos = posById.get(selId);
      if (!selTid || !selPos) continue;

      const partners: { id: string; score: number }[] = [];
      for (const n of nodes) {
        if (n.id === selId) continue;
        const tid = tidById.get(n.id);
        if (!tid) continue;
        const score = getAffinity(selTid, tid);
        if (score !== null && score >= EDGE_MIN_SCORE) partners.push({ id: n.id, score });
      }
      partners.sort((a, b) => b.score - a.score);

      for (const { id, score } of partners.slice(0, EDGE_TOP_N)) {
        const key = selId < id ? `${selId}|${id}` : `${id}|${selId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const targetPos = posById.get(id);
        if (targetPos) out.push({ points: [selPos, targetPos], score });
      }
    }
    return out;
  }, [nodes, selectedSpiceIds]);

  return (
    <group>
      {edges.map((e, i) => {
        const t = (e.score - EDGE_MIN_SCORE) / (1 - EDGE_MIN_SCORE);
        return (
          <Line
            key={i}
            points={e.points}
            color="#22d3ee"
            lineWidth={1 + t * 3}
            opacity={0.25 + t * 0.6}
            transparent
          />
        );
      })}
    </group>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface FlavorMapProps {
  data: SpiceNode[];
}

export default function FlavorMap3D({ data }: FlavorMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [xDim, setXDim] = useState<FlavorDim>('warmth');
  const [yDim, setYDim] = useState<FlavorDim>('brightness');
  const [zDim, setZDim] = useState<FlavorDim>('earthiness');
  const { selectedSpiceIds, toggleSpice } = useSelection();

  const hasSelection = selectedSpiceIds.size > 0;

  const xLabel = DIMS.find((d) => d.key === xDim)!.label;
  const yLabel = DIMS.find((d) => d.key === yDim)!.label;
  const zLabel = DIMS.find((d) => d.key === zDim)!.label;

  const spiceProps = useMemo(
    () =>
      data.map((spice) => ({
        spice,
        position: [
          toCoord(spice[xDim] ?? 50),
          toCoord(spice[yDim] ?? 50),
          toCoord(spice[zDim] ?? 50),
        ] as [number, number, number],
        radius: 0.15 + (spice.intensity / 100) * 0.30,
        color: FAMILY_COLORS[spice.family] || '#90caf9',
        emissiveIntensity: 0.1 + (spice.commonality / 100) * 0.5,
      })),
    [data, xDim, yDim, zDim]
  );

  const axisControls: [string, string, string, FlavorDim, (v: FlavorDim) => void][] = [
    ['X', 'text-red-400', 'border-red-400/30', xDim, setXDim],
    ['Y', 'text-emerald-400', 'border-emerald-400/30', yDim, setYDim],
    ['Z', 'text-blue-400', 'border-blue-400/30', zDim, setZDim],
  ];

  return (
    <div className="w-full h-full relative bg-[#050505] overflow-hidden">

      {/* Axis controls — top left, beside the nav hamburger (right side is the pairing panel) */}
      <div className="absolute top-4 left-16 z-10 flex flex-col gap-2 bg-black/50 backdrop-blur-md rounded-xl px-3.5 py-3 border border-white/10">
        <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-medium">Axes</div>
        {axisControls.map(([label, colorClass, borderClass, val, setter]) => (
          <div key={label} className={`flex items-center gap-2.5 pl-2 border-l-2 ${borderClass}`}>
            <span className={`text-[11px] font-mono font-bold w-3 ${colorClass}`}>{label}</span>
            <select
              value={val}
              onChange={(e) => setter(e.target.value as FlavorDim)}
              className="px-2 py-1 bg-white/6 border border-white/12 rounded-md text-[12px] text-white/90 hover:bg-white/12 transition-colors min-w-[100px]"
            >
              {DIMS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <Canvas camera={{ position: [8, 6, 18], fov: 45 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-8, -8, -8]} intensity={0.4} color="#4f46e5" />

        <color attach="background" args={['#050505']} />
        <Stars radius={60} depth={50} count={1200} factor={2} saturation={0} fade speed={0.3} />

        <AxisGuides xLabel={xLabel} yLabel={yLabel} zLabel={zLabel} />
        <FloorGrid />

        <AffinityEdges3D
          nodes={spiceProps.map(({ spice, position }) => ({ id: spice.id, position }))}
        />

        <group>
          {spiceProps.map(({ spice, position, radius, color, emissiveIntensity }) => (
            <SpiceDot
              key={spice.id}
              spice={spice}
              position={position}
              radius={radius}
              color={color}
              emissiveIntensity={emissiveIntensity}
              isSelected={selectedSpiceIds.has(spice.id)}
              isDimmed={hasSelection && !selectedSpiceIds.has(spice.id)}
              hovered={hovered}
              setHovered={setHovered}
              onSelect={() => toggleSpice(spice.id)}
            />
          ))}
        </group>

        {/* dampingFactor 0.35 — snaps to rest on slow release, still feels smooth on fast drags */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={4}
          maxDistance={40}
          autoRotate={false}
          dampingFactor={0.35}
        />
      </Canvas>

      {/* Legend — bottom left */}
      <div className="absolute bottom-5 left-5 z-10 pointer-events-none">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-w-xs">
          {Object.entries(FAMILY_COLORS).map(([family, color]) => (
            <div key={family} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-white/55 capitalize">{family.replace('-', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls hint — bottom center, clear of the right-side pairing panel */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-[10px] text-white/25 text-center space-x-3">
        <span>Drag to rotate · Scroll to zoom</span>
        <span>Click to select</span>
      </div>
    </div>
  );
}
