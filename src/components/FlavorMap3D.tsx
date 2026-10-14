'use client';

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, ContactShadows, Environment, Lightformer } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { familyLabel } from '@/lib/colors';
import { spiceColor, luminance } from '@/lib/spice-colors';
import { useSelection } from '@/context/SelectionContext';
import { getAffinity } from '@/lib/pairing-engine';
import { toTaxonomyId } from '@/lib/spice-id-map';
import { THEME } from '@/lib/theme';
import aromaData from '@/data/aroma-fingerprints.json';
import type { SpiceProfile } from '@/types/spice';

export interface MapMorph {
  progress: number;
  active: boolean;
  targets: Map<string, { x: number; y: number; radius: number; opacity: number }>;
}

const EDGE_TOP_N = 6;
const R = 5.5; // half-size of the flavor box in world units
const FLOOR = -R;

type FlavorDim = 'warmth' | 'brightness' | 'earthiness' | 'florality' | 'heat';

const DIMS: { key: FlavorDim; label: string }[] = [
  { key: 'warmth', label: 'Warmth' },
  { key: 'brightness', label: 'Brightness' },
  { key: 'earthiness', label: 'Earthiness' },
  { key: 'florality', label: 'Florality' },
  { key: 'heat', label: 'Heat' },
];

const toCoord = (value: number) => (value - 50) / 10;
const damp = (dt: number, speed: number) => 1 - Math.exp(-dt * speed);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// Measured aroma (FlavorDB2 + FooDB descriptors), keyed by taxonomy id.
const AROMA_WORDS: Record<string, string> = {
  woody: 'woody',
  citrus: 'citrus',
  floral: 'floral',
  'sweet-balsamic': 'sweet',
  'spicy-phenolic': 'spicy',
  'green-herbal': 'green',
  'earthy-roasty': 'roasty',
  'sulfurous-alliaceous': 'oniony',
  'minty-camphor': 'minty',
  fruity: 'fruity',
  'fatty-waxy': 'waxy',
  nutty: 'nutty',
};
type AromaEntry = { vector: Record<string, number> | null };
const aroma = aromaData as unknown as Record<string, AromaEntry>;
function measuredAroma(slug: string, name: string): string[] {
  const tid = toTaxonomyId(slug, name);
  const vector = tid ? aroma[tid]?.vector : null;
  if (!vector) return [];
  return Object.entries(vector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => AROMA_WORDS[k] ?? k);
}

// ─── Scene dressing ─────────────────────────────────────────────────────────

function Plate({ children, tone = 'quiet' }: { children: React.ReactNode; tone?: 'quiet' | 'strong' | 'selected' }) {
  const toneClass =
    tone === 'selected'
      ? 'bg-chalk text-board font-semibold'
      : tone === 'strong'
        ? 'bg-board-raised text-chalk font-medium ring-1 ring-white/20'
        : 'bg-board/90 text-chalk-2 ring-1 ring-white/10';
  return (
    <span className={`inline-block whitespace-nowrap rounded-[5px] px-1.5 py-[3px] text-[13px] leading-none shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${toneClass}`}>
      {children}
    </span>
  );
}

const AxisGuides = ({ xLabel, yLabel, zLabel, quiet, hideLabels }: { xLabel: string; yLabel: string; zLabel: string; quiet: boolean; hideLabels: boolean }) => {
  const portrait = useThree((s) => s.size.width / s.size.height < 0.85);
  const axes: { points: [number, number, number][]; tip: [number, number, number]; label: string }[] = [
    { points: [[-R, FLOOR, -R], [R, FLOOR, -R]], tip: [R + 0.2, FLOOR, -R], label: xLabel },
    { points: [[-R, FLOOR, -R], [-R, R, -R]], tip: [-R, R + 0.45, -R], label: yLabel },
    { points: [[-R, FLOOR, -R], [-R, FLOOR, R]], tip: [-R, FLOOR, R + 0.2], label: zLabel },
  ];
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(R * 2, 10, THEME.chalk, THEME.chalk);
    const m = g.material as THREE.Material;
    m.transparent = true;
    m.opacity = 0.06;
    m.depthWrite = false;
    return g;
  }, []);
  return (
    <group>
      {axes.map(({ points, tip, label }, i) => (
        <group key={label}>
          <Line points={points} color={THEME.chalk} lineWidth={1.4} transparent opacity={quiet ? 0.16 : 0.4} />
          {!hideLabels && !(portrait && i !== 1) && (
            <Html position={tip} center zIndexRange={[20, 10]} className="pointer-events-none select-none">
              <span className="block transition-opacity duration-300" style={{ opacity: quiet ? 0.45 : 1 }}>
                <Plate>More {label.toLowerCase()}</Plate>
              </span>
            </Html>
          )}
        </group>
      ))}
      <primitive object={grid} position={[0, FLOOR, 0]} />
    </group>
  );
};

/** Studio light made from local light-formers: soft key, cool fill, warm rim. No network fetch. */
function StudioLight() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={2.2} color="#fff4e6" position={[4, 6, 6]} scale={[8, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.8} color="#cfdbe6" position={[-7, 2, -3]} scale={[6, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={1.4} color="#ffe2c4" position={[0, 3, -8]} scale={4} target={[0, 0, 0]} />
    </Environment>
  );
}

// ─── Spice sphere ───────────────────────────────────────────────────────────

/** Soft radial glow, drawn once and shared by every halo. */
let haloTex: THREE.Texture | null = null;
function haloTexture(): THREE.Texture {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

type DotState = 'idle' | 'selected' | 'partner' | 'dimmed';

interface SpiceDotProps {
  morph?: React.RefObject<MapMorph>;
  spice: SpiceProfile;
  delay: number;
  target: [number, number, number];
  radius: number;
  color: string;
  state: DotState;
  labelVisible: boolean;
  isLabelCandidate: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

const SpiceDot = React.memo(function SpiceDot({
  morph, spice, delay, target, radius, color, state, labelVisible, isLabelCandidate, hovered, onHover, onSelect,
}: SpiceDotProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.Sprite>(null);
  const haloMaterial = useRef<THREE.SpriteMaterial>(null);
  const targetVec = useMemo(() => new THREE.Vector3(...target), [target]);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  const dark = luminance(color) < 0.04;
  const { camera, size } = useThree();
  const flat = useMemo(() => new THREE.Vector3(), []);
  const labelRef = useRef<HTMLSpanElement>(null);
  const wasMorphing = useRef(false);
  // R3F resets its clock when a suspended canvas resumes. Keep intro age here.
  const introTime = useRef(0);
  const atlasMix = useRef({ value: 0 });

  useFrame((frame, dt) => {
    const g = group.current;
    const m = material.current;
    const b = body.current;
    if (!g || !m || !b) return;
    const p = morph?.current.progress ?? 0;
    atlasMix.current.value = p;
    const destination = morph?.current.targets.get(spice.id);
    const morphing = !!(morph?.current.active || p > 0);
    const restoring = wasMorphing.current && !morphing;
    wasMorphing.current = morphing;
    // Intro: rise from the floor in a left-to-right sweep.
    introTime.current += Math.min(dt, 0.1);
    const intro = easeOutCubic((introTime.current - delay) / 0.9);

    // Glide toward the target position: axis changes animate instead of jumping.
    if (morphing && destination) {
      // Unproject the actual SVG mark onto a plane perpendicular to the camera.
      // As the camera rotates front-on, world depth collapses into this plane.
      const cam = camera as THREE.PerspectiveCamera;
      const distance = 24;
      const ndcZ = ((cam.far + cam.near) - 2 * cam.far * cam.near / distance) / (cam.far - cam.near);
      flat.set(destination.x, destination.y, ndcZ).unproject(camera);
      g.position.copy(targetVec).lerp(flat, p);
    } else if (restoring) {
      g.position.copy(targetVec);
    } else {
      g.position.lerp(targetVec, damp(dt, 5));
    }
    const rise = (1 - intro) * (1 - p) * (FLOOR - g.position.y);
    b.position.y = rise;

    const pixelScale = destination ? destination.radius * (2 * 24 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2)) / size.height) / radius : 1;
    const targetScale = THREE.MathUtils.lerp((hovered ? 1.28 : state === 'selected' ? 1.14 : 1) * intro, pixelScale, p);
    b.scale.setScalar(Math.max(0.0001, (morphing || restoring ? targetScale : THREE.MathUtils.lerp(b.scale.x, targetScale, damp(dt, 12)))));

    if (morphing) {
      b.quaternion.copy(camera.quaternion);
      b.scale.z *= Math.max(0.001, 1 - p);
    } else {
      b.quaternion.identity();
    }

    const targetOpacity = THREE.MathUtils.lerp(state === 'dimmed' ? 0.14 : 1, destination?.opacity ?? 0, p);
    if (labelRef.current) labelRef.current.style.opacity = String((labelVisible && !hovered ? 1 : 0) * (1 - Math.min(1, p * 4)));
    m.opacity = morphing || restoring ? targetOpacity : THREE.MathUtils.lerp(m.opacity, targetOpacity, damp(dt, 8));
    m.depthWrite = m.opacity > 0.5;
    const glow = hovered ? 0.32 : state === 'selected' ? 0.18 : dark ? 0.1 : 0.02;
    m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, glow, damp(dt, 10));

    // Selection ring faces the camera and eases in.
    if (ring.current && ringMaterial.current) {
      ring.current.quaternion.copy(camera.quaternion);
      ring.current.position.y = rise;
      const on = state === 'selected' ? 1 : 0;
      ringMaterial.current.opacity = THREE.MathUtils.lerp(ringMaterial.current.opacity, on * 0.55 * (1 - p), damp(dt, 9));
      ring.current.scale.setScalar(THREE.MathUtils.lerp(ring.current.scale.x, on ? 1 : 0.6, damp(dt, 9)));
      ring.current.visible = ringMaterial.current.opacity > 0.01;
    }
    if (halo.current && haloMaterial.current) {
      halo.current.position.y = rise;
      const on = state === 'selected' ? 0.75 : hovered ? 0.45 : state === 'partner' ? 0.22 : 0;
      haloMaterial.current.opacity = THREE.MathUtils.lerp(haloMaterial.current.opacity, on * (1 - p), damp(dt, 8));
      halo.current.visible = haloMaterial.current.opacity > 0.01;
    }
  });

  return (
    <group ref={group} position={target}>
      <mesh
        ref={body}
        onClick={(e) => { e.stopPropagation(); onSelect(spice.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(spice.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = 'auto'; }}
        scale={0.0001}
      >
        <sphereGeometry args={[radius, 36, 28]} />
        <meshPhysicalMaterial
          ref={material}
          onBeforeCompile={shader => {
            // Blend lighting into the atlas's flat pigment and sheen while the
            // mesh flattens. One shared shader program, per-spice uniforms.
            shader.uniforms.atlasMix = atlasMix.current;
            shader.uniforms.atlasRadius = { value: radius };
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nuniform float atlasRadius;\nvarying vec2 atlasPosition;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\natlasPosition = position.xy / atlasRadius;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform float atlasMix;\nvarying vec2 atlasPosition;')
              .replace('#include <fog_fragment>', `#include <fog_fragment>
                vec3 pigment = linearToOutputTexel(vec4(diffuseColor.rgb, 1.0)).rgb;
                float sheen = 0.32 * max(0.0, 1.0 - distance(atlasPosition, vec2(-0.3, 0.4)) / 0.715);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(pigment, vec3(1.0), sheen), atlasMix);
              `);
          }}
          color={threeColor}
          roughness={0.58}
          metalness={0}
          clearcoat={0.35}
          clearcoatRoughness={0.45}
          sheen={0.5}
          sheenRoughness={0.7}
          sheenColor="#ffffff"
          emissive={threeColor}
          emissiveIntensity={0.02}
          envMapIntensity={0.9}
          transparent
          opacity={1}
        />
      </mesh>

      <sprite ref={halo} scale={radius * 5.2} visible={false} renderOrder={-1}>
        <spriteMaterial ref={haloMaterial} map={haloTexture()} color={dark ? THEME.chalk2 : color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh ref={ring} visible={false}>
        <ringGeometry args={[radius * 1.4, radius * 1.4 + 0.03, 64]} />
        <meshBasicMaterial ref={ringMaterial} color={THEME.chalk} transparent opacity={0} depthWrite={false} />
      </mesh>

      {isLabelCandidate && (
        <Html position={[0, -radius - 0.32, 0]} center zIndexRange={[40, 21]} className="pointer-events-none select-none">
          <span
            ref={labelRef}
            className="block transition-[opacity,transform] duration-300 ease-out"
            style={{ opacity: labelVisible && !hovered ? 1 : 0, transform: `translateY(${labelVisible ? 0 : 4}px)` }}
          >
            <Plate tone={state === 'selected' ? 'selected' : state === 'partner' ? 'strong' : 'quiet'}>{spice.name}</Plate>
          </span>
        </Html>
      )}

    </group>
  );
});

const CARD_AXES: { key: FlavorDim; label: string }[] = [
  { key: 'warmth', label: 'Warm' },
  { key: 'brightness', label: 'Bright' },
  { key: 'earthiness', label: 'Earthy' },
  { key: 'florality', label: 'Floral' },
  { key: 'heat', label: 'Heat' },
];

function SpiceCard({ spice, color, selected }: { spice: SpiceProfile; color: string; selected: boolean }) {
  const notes = measuredAroma(spice.id, spice.name);
  const barColor = luminance(color) < 0.05 ? THEME.chalk2 : color;
  return (
    <div className="rise-in w-[272px] rounded-xl bg-board-raised p-4 text-left shadow-[0_24px_48px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(243,239,232,0.14)]">
      <div className="flex items-center gap-3">
        <span
          className="h-9 w-9 shrink-0 rounded-full"
          style={{
            backgroundColor: color,
            backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 55%)',
            boxShadow: 'inset 0 0 0 1px rgba(243,239,232,0.2), 0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
        <div className="min-w-0">
          <p className="font-display text-[22px] leading-tight text-chalk">{spice.name}</p>
          <p className="text-small text-chalk-2">
            {familyLabel(spice.family)}
            {spice.origin ? `, ${spice.origin.split(',')[0].trim()}` : ''}
          </p>
        </div>
      </div>
      {spice.description && <p className="mt-3 line-clamp-3 text-small leading-relaxed text-chalk-2">{spice.description}</p>}
      {notes.length > 0 && (
        <p className="mt-2.5 text-small text-chalk-2">
          <span className="text-chalk-3">Measured aroma </span>
          <span className="text-chalk">{notes.join(', ')}</span>
        </p>
      )}
      <dl className="mt-3 grid gap-1.5">
        {CARD_AXES.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[52px_1fr_26px] items-center gap-2.5">
            <dt className="text-micro text-chalk-3">{label}</dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-board-high">
              <span className="block h-full rounded-full" style={{ width: `${spice[key]}%`, backgroundColor: barColor }} />
            </dd>
            <dd className="text-right text-micro text-chalk-2">{spice[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3.5 border-t border-rule pt-2.5 text-small font-medium text-chalk">
        {selected ? 'Click to remove from your blend' : 'Click to see what it pairs with'}
      </p>
    </div>
  );
}

// ─── Evidence arcs ──────────────────────────────────────────────────────────

interface Edge {
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  rank: number;
  color: string;
}

type DashLine = { material: { dashOffset: number; opacity: number } };

/** A chalk arc that draws itself outward from the chosen spice when it first appears. */
function EvidenceArc({ edge, morph }: { edge: Edge; morph?: React.RefObject<MapMorph> }) {
  const ref = useRef<DashLine | null>(null);
  const age = useRef(0);
  const { points, length } = useMemo(() => {
    const a = new THREE.Vector3(...edge.from);
    const b = new THREE.Vector3(...edge.to);
    const mid = a.clone().lerp(b, 0.5);
    const dist = a.distanceTo(b);
    // Always a visible curve: lift, plus a sideways bow for near-vertical pairs.
    mid.y += Math.max(dist * 0.22 + 0.3, 0.9);
    const dir = b.clone().sub(a).normalize();
    const side = Math.abs(dir.y) > 0.8 ? new THREE.Vector3(1, 0, -1).normalize() : new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    mid.add(side.multiplyScalar(dist * 0.12));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    return { points: curve.getPoints(40).map((p) => [p.x, p.y, p.z] as [number, number, number]), length: curve.getLength() };
  }, [edge.from, edge.to]);
  const opacity = 0.9 - edge.rank * 0.1;

  useFrame((_, dt) => {
    const line = ref.current;
    if (!line) return;
    age.current += dt;
    const p = easeOutCubic((age.current - edge.rank * 0.07) / 0.75);
    line.material.dashOffset = length * (1 - p);
    line.material.opacity = opacity * Math.min(1, p * 2) * Math.pow(1 - (morph?.current.progress ?? 0), 3);
  });

  return (
    <Line
      ref={ref as never}
      points={points}
      color={edge.color}
      lineWidth={2.6 - edge.rank * 0.28}
      transparent
      opacity={0}
      dashed
      dashSize={length}
      gapSize={length}
      dashOffset={length}
      depthWrite={false}
    />
  );
}

function usePartners(
  nodes: { id: string; name: string; target: [number, number, number]; color: string }[],
  selectedSpiceIds: Set<string>
) {
  return useMemo(() => {
    // Arcs carry a chalky tint of the spice they start from, so each fan is traceable.
    const colorById = new Map(nodes.map((n) => [n.id, '#' + new THREE.Color(THEME.chalk).lerp(new THREE.Color(n.color), luminance(n.color) < 0.05 ? 0.3 : 0.78).getHexString()]));
    const partners = new Set<string>();
    const edges: Edge[] = [];
    if (selectedSpiceIds.size === 0) return { partners, edges };
    const tidById = new Map<string, string>();
    const posById = new Map<string, [number, number, number]>();
    for (const n of nodes) {
      const tid = toTaxonomyId(n.id, n.name);
      if (tid) tidById.set(n.id, tid);
      posById.set(n.id, n.target);
    }
    const seen = new Set<string>();
    for (const selId of selectedSpiceIds) {
      const selTid = tidById.get(selId);
      const selPos = posById.get(selId);
      if (!selTid || !selPos) continue;
      const ranked: { id: string; score: number }[] = [];
      for (const n of nodes) {
        if (n.id === selId) continue;
        const tid = tidById.get(n.id);
        if (!tid || tid === selTid) continue;
        const score = getAffinity(selTid, tid);
        if (score !== null) ranked.push({ id: n.id, score });
      }
      // Rank locally: almost every pair clears a fixed cutoff, so only the top few carry meaning.
      ranked.sort((a, b) => b.score - a.score);
      ranked.slice(0, EDGE_TOP_N).forEach(({ id }, rank) => {
        if (!selectedSpiceIds.has(id)) partners.add(id);
        const key = selId < id ? `${selId}|${id}` : `${id}|${selId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const to = posById.get(id);
        if (to) edges.push({ key: `${selId}>${id}>${to.join(',')}`, from: selPos, to, rank, color: colorById.get(selId) ?? THEME.chalk });
      });
    }
    return { partners, edges };
  }, [nodes, selectedSpiceIds]);
}

// ─── Camera, framing & labels ───────────────────────────────────────────────

/** Center the board in the space the panel leaves free, and widen the lens on portrait screens. */
function Framing({ right, bottom }: { right: number; bottom: number }) {
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const cam = get().camera as THREE.PerspectiveCamera;
    cam.fov = size.width / size.height < 0.85 ? 56 : 40;
    cam.setViewOffset(size.width, size.height, right / 2, bottom / 2, size.width, size.height);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    };
  }, [get, size.width, size.height, right, bottom]);
  return null;
}

/**
 * The opening move: the camera eases in from further out while the spices rise,
 * then the board drifts slowly until someone touches it. On selection, the view
 * leans toward the chosen spices.
 */
function CameraDirector({
  controls,
  focus,
  morph,
}: {
  controls: React.RefObject<OrbitControlsImpl | null>;
  focus: THREE.Vector3 | null;
  morph?: React.RefObject<MapMorph>;
}) {
  const portrait = useThree((s) => s.size.width / s.size.height < 0.85);
  const home = useMemo(() => new THREE.Vector3(0, portrait ? -0.2 : -0.6, 0), [portrait]);
  const startOffset = useMemo(() => new THREE.Vector3(15, 10, 21), []);
  // Phones: come in closer and flatter so the cluster fills the narrow screen.
  const endOffset = useMemo(() => (portrait ? new THREE.Vector3(9.5, 4.5, 13) : new THREE.Vector3(11, 6.5, 15)), [portrait]);
  const done = useRef(false);
  const introTime = useRef(0);
  const saved = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const frontDirection = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Quaternion(), []);
  const turnRotation = useMemo(() => new THREE.Quaternion(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((frame, dt) => {
    const c = controls.current;
    if (!c) return;
    introTime.current += Math.min(dt, 0.1);
    const p = morph?.current.progress ?? 0;
    if (morph?.current.active || p > 0) {
      if (!saved.current) saved.current = { position: frame.camera.position.clone(), target: c.target.clone() };
      // Rotate front-on first; the final stretch collapses all remaining depth.
      // In reverse, depth opens up before the camera returns to the 3D angle.
      const turn = Math.min(1, p / 0.65);
      const cameraProgress = turn * turn * (3 - 2 * turn);
      c.target.copy(saved.current.target).lerp(origin, cameraProgress);
      tmp.copy(saved.current.position).sub(saved.current.target);
      const distance = tmp.length();
      rotation.setFromUnitVectors(direction.copy(tmp).normalize(), frontDirection);
      turnRotation.identity().slerp(rotation, cameraProgress);
      tmp.normalize().applyQuaternion(turnRotation).multiplyScalar(THREE.MathUtils.lerp(distance, 24, cameraProgress));
      frame.camera.position.copy(tmp).add(c.target);
      frame.camera.lookAt(c.target);
      frame.camera.updateMatrixWorld();
      return;
    }
    if (saved.current) {
      frame.camera.position.copy(saved.current.position);
      c.target.copy(saved.current.target);
      saved.current = null;
      done.current = true;
    }
    if (!done.current) {
      const p = easeOutCubic(introTime.current / 2.2);
      frame.camera.position.copy(tmp.copy(startOffset).lerp(endOffset, p).add(c.target));
      if (p >= 1) done.current = true;
    }
    c.target.lerp(focus ?? home, damp(dt, 2.2));
    c.update();
  }, -2);
  return null;
}

interface LabelCandidate {
  id: string;
  name: string;
  priority: number;
  anchor: [number, number, number];
}

/**
 * Screen-space label layout, a few times a second:
 *  - a label is hidden when a nearer sphere covers the spot it would sit on,
 *  - higher-priority labels win collisions,
 *  - changes need two consecutive checks to take effect, so labels don't flicker while the board turns.
 */
function LabelCuller({
  candidates,
  spheres,
  onChange,
}: {
  candidates: LabelCandidate[];
  spheres: { id: string; center: [number, number, number]; radius: number; occludes: boolean }[];
  onChange: (ids: Set<string>) => void;
}) {
  const { camera, size } = useThree();
  const shown = useRef<Set<string>>(new Set());
  const streak = useRef<Map<string, number>>(new Map());
  const timer = useRef(1);
  const age = useRef(0);
  const v = useMemo(() => new THREE.Vector3(), []);
  const edge = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    timer.current += dt;
    age.current += dt;
    if (timer.current < 0.2 || age.current < 1.8) return;
    timer.current = 0;

    const toScreen = (p: THREE.Vector3) => ({ x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height });
    // Project every sphere once: screen disk + camera distance.
    const disks = spheres.map((sp) => {
      v.set(...sp.center);
      const depth = v.distanceTo(camera.position);
      edge.copy(v).addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), sp.radius);
      const c = toScreen(v.project(camera));
      const e = toScreen(edge.project(camera));
      return { id: sp.id, x: c.x, y: c.y, r: Math.hypot(e.x - c.x, e.y - c.y), depth, occludes: sp.occludes };
    });
    const depthOf = new Map(disks.map((d) => [d.id, d.depth]));

    const ordered = [...candidates].sort((a, b) => b.priority - a.priority);
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const want = new Set<string>();
    for (const c of ordered) {
      v.set(...c.anchor).project(camera);
      if (v.z > 1) continue;
      const { x, y } = toScreen(v);
      const half = (c.name.length * 7.4) / 2 + 9;
      const box = { x0: x - half, x1: x + half, y0: y - 12, y1: y + 12 };
      // Stay on screen and clear of the arrange control in the top-left corner.
      if (box.x0 < 8 || box.x1 > size.width - 8 || box.y0 < 8) continue;
      if (box.x0 < (size.width < 768 ? 340 : 270) && box.y0 < (size.width < 768 ? 64 : 230)) continue;
      const myDepth = depthOf.get(c.id) ?? 0;
      // Hidden only when the label's centre sits inside a clearly nearer, visible sphere.
      const covered = disks.some((d) => d.occludes && d.id !== c.id && d.depth < myDepth - 0.4 && Math.hypot(d.x - x, d.y - y) < d.r * 0.85);
      if (covered) continue;
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      want.add(c.id);
    }

    // Hysteresis: flip a label only after two checks agree.
    let changed = false;
    const ids = new Set([...want, ...shown.current]);
    for (const id of ids) {
      const isShown = shown.current.has(id);
      const wants = want.has(id) && candidates.some((c) => c.id === id);
      if (isShown === wants) { streak.current.delete(id); continue; }
      const n = (streak.current.get(id) ?? 0) + 1;
      // Selected and partner labels (priority ≥ 500) react immediately.
      const urgent = (candidates.find((c) => c.id === id)?.priority ?? 0) >= 500 && wants;
      if (n >= 2 || urgent || !candidates.some((c) => c.id === id)) {
        if (wants) shown.current.add(id); else shown.current.delete(id);
        streak.current.delete(id);
        changed = true;
      } else {
        streak.current.set(id, n);
      }
    }
    if (changed) onChange(new Set(shown.current));
  });
  return null;
}

// ─── Main component ─────────────────────────────────────────────────────────

/** Scene guides dissolve as the volume becomes a plane. */
function MorphGuides({ morph, children }: { morph?: React.RefObject<MapMorph>; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const original = useMemo(() => new WeakMap<THREE.Material, number>(), []);
  useFrame(() => {
    const opacity = Math.pow(1 - (morph?.current.progress ?? 0), 3);
    group.current?.traverse(object => {
      const material = (object as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        if (!original.has(m)) original.set(m, m.opacity);
        m.opacity = original.get(m)! * opacity;
      }
    });
    if (group.current) group.current.visible = opacity > 0.001;
  });
  return <group ref={group}>{children}</group>;
}

interface FlavorMapProps {
  data: SpiceProfile[];
  panelInsets?: { right: number; bottom: number };
  morph?: React.RefObject<MapMorph>;
  active?: boolean;
  transitioning?: boolean;
}

export default function FlavorMap3D({ data, panelInsets = { right: 0, bottom: 0 }, morph, active = true, transitioning = false }: FlavorMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [xDim, setXDim] = useState<FlavorDim>('warmth');
  const [yDim, setYDim] = useState<FlavorDim>('brightness');
  const [zDim, setZDim] = useState<FlavorDim>('earthiness');
  const [axesOpen, setAxesOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [labelled, setLabelled] = useState<Set<string>>(new Set());
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const hoveredSpice = hovered ? data.find((s) => s.id === hovered) ?? null : null;
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { selectedSpiceIds, toggleSpice } = useSelection();
  const hasSelection = selectedSpiceIds.size > 0;

  const label = (d: FlavorDim) => DIMS.find((x) => x.key === d)!.label;

  const nodes = useMemo(
    () =>
      data.map((spice, i) => {
        const target = [toCoord(spice[xDim] ?? 50), toCoord(spice[yDim] ?? 50), toCoord(spice[zDim] ?? 50)] as [number, number, number];
        return {
          spice,
          id: spice.id,
          name: spice.name,
          target,
          radius: 0.17 + (spice.intensity / 100) * 0.25,
          color: spiceColor(spice.id, spice.name, spice.family),
          // Intro sweep: left to right, with a little jitter so it reads as organic.
          delay: 0.25 + ((toCoord(spice.warmth ?? 50) + R) / (2 * R)) * 0.9 + ((i * 37) % 11) * 0.02,
        };
      }),
    [data, xDim, yDim, zDim]
  );

  const { partners, edges } = usePartners(nodes, selectedSpiceIds);

  const focus = useMemo(() => {
    if (!hasSelection) return null;
    const sel = nodes.filter((n) => selectedSpiceIds.has(n.id) || partners.has(n.id));
    if (sel.length === 0) return null;
    const c = new THREE.Vector3();
    sel.forEach((n) => c.add(new THREE.Vector3(...n.target)));
    c.divideScalar(sel.length);
    // Lean only part of the way, so the whole board stays in view.
    return c.multiplyScalar(0.5).add(new THREE.Vector3(0, -0.3, 0));
  }, [hasSelection, nodes, selectedSpiceIds, partners]);

  const labelCandidates = useMemo<LabelCandidate[]>(() => {
    const pool = hasSelection
      ? nodes.filter((n) => selectedSpiceIds.has(n.id) || partners.has(n.id))
      : [...nodes].sort((a, b) => b.spice.commonality - a.spice.commonality).slice(0, 26);
    return pool.map((n) => ({
      id: n.id,
      name: n.name,
      priority: (selectedSpiceIds.has(n.id) ? 1000 : partners.has(n.id) ? 500 : 0) + n.spice.commonality,
      anchor: [n.target[0], n.target[1] - n.radius - 0.32, n.target[2]],
    }));
  }, [nodes, hasSelection, selectedSpiceIds, partners]);
  const candidateIds = useMemo(() => new Set(labelCandidates.map((c) => c.id)), [labelCandidates]);

  function chooseAxis(axis: 'x' | 'y' | 'z', value: FlavorDim) {
    const current = { x: xDim, y: yDim, z: zDim };
    const setters = { x: setXDim, y: setYDim, z: setZDim };
    const clash = (Object.keys(current) as ('x' | 'y' | 'z')[]).find((k) => k !== axis && current[k] === value);
    if (clash) setters[clash](current[axis]);
    setters[axis](value);
  }

  const axisRows: { axis: 'x' | 'y' | 'z'; name: string; value: FlavorDim }[] = [
    { axis: 'x', name: 'Across', value: xDim },
    { axis: 'y', name: 'Up', value: yDim },
    { axis: 'z', name: 'Depth', value: zDim },
  ];

  return (
    <div
      className="slate relative isolate h-full w-full overflow-hidden"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
      }}
      onPointerLeave={() => setPointer(null)}
    >
      <Canvas
        frameloop={active || transitioning ? 'always' : 'demand'}
        camera={{ position: [15, 10, 21], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onPointerMissed={() => setHovered(null)}
      >
        <fog attach="fog" args={[THEME.board, 22, 46]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[6, 12, 8]} intensity={1.1} color="#fff6ea" />
        <StudioLight />
        <Framing right={panelInsets.right} bottom={panelInsets.bottom} />

        <MorphGuides morph={morph}>
        <AxisGuides xLabel={label(xDim)} yLabel={label(yDim)} zLabel={label(zDim)} quiet={hasSelection} hideLabels={transitioning} />
        <ContactShadows position={[0, FLOOR + 0.01, 0]} scale={R * 2.4} resolution={512} blur={2.2} opacity={0.4} far={3.5} color="#0b0d0f" />

        {edges.map((e) => (
          <EvidenceArc key={e.key} edge={e} morph={morph} />
        ))}

        </MorphGuides>

        {nodes.map(({ spice, target, radius, color, delay }) => {
          const selected = selectedSpiceIds.has(spice.id);
          const state: DotState = selected ? 'selected' : partners.has(spice.id) ? 'partner' : hasSelection ? 'dimmed' : 'idle';
          return (
            <SpiceDot
              key={spice.id}
              spice={spice}
              morph={morph}
              delay={delay}
              target={target}
              radius={radius}
              color={color}
              state={state}
              isLabelCandidate={candidateIds.has(spice.id)}
              labelVisible={!transitioning && labelled.has(spice.id)}
              hovered={hovered === spice.id}
              onHover={setHovered}
              onSelect={toggleSpice}
            />
          );
        })}

        <LabelCuller
          candidates={labelCandidates}
          spheres={nodes.map((n) => ({
            id: n.id,
            center: n.target,
            radius: n.radius,
            // Faded spheres don't hide labels.
            occludes: !hasSelection || selectedSpiceIds.has(n.id) || partners.has(n.id),
          }))}
          onChange={setLabelled}
        />
        <OrbitControls
          ref={controls}
          enabled={active && !transitioning}
          enablePan={false}
          enableZoom
          minDistance={8}
          maxDistance={34}
          enableDamping={!transitioning}
          dampingFactor={0.08}
          autoRotate={active && !transitioning && !touched && !hasSelection}
          autoRotateSpeed={0.22}
          onStart={() => setTouched(true)}
        />
        <CameraDirector controls={controls} focus={focus} morph={morph} />
      </Canvas>

      {/* Hover card follows the pointer and flips away from edges, so it is never clipped. */}
      {!transitioning && hoveredSpice && pointer && (
        <div
          className="pointer-events-none absolute z-[60]"
          style={{
            left: pointer.x + 300 > pointer.w - panelInsets.right ? pointer.x - 290 : pointer.x + 18,
            ...(pointer.y > pointer.h / 2 ? { bottom: pointer.h - pointer.y + 14 } : { top: pointer.y + 14 }),
          }}
        >
          <SpiceCard
            key={hoveredSpice.id}
            spice={hoveredSpice}
            color={spiceColor(hoveredSpice.id, hoveredSpice.name, hoveredSpice.family)}
            selected={selectedSpiceIds.has(hoveredSpice.id)}
          />
        </div>
      )}

      {/* Arrange-by control */}
      <div className="absolute left-4 top-4 z-10" style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 120ms' }}>
        <button
          type="button"
          onClick={() => setAxesOpen((v) => !v)}
          aria-expanded={axesOpen}
          className="flex h-10 items-center gap-2 rounded-lg bg-board-raised/95 px-3.5 text-small font-medium text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14),0_8px_24px_rgba(0,0,0,0.3)] md:hidden"
        >
          Arrange by {label(xDim).toLowerCase()}, {label(yDim).toLowerCase()}, {label(zDim).toLowerCase()}
        </button>
        <div
          className={`${axesOpen ? 'mt-2 block' : 'hidden'} rise-in rounded-xl bg-board-raised/95 p-4 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.12),0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur md:block`}
        >
          <p className="mb-3 font-display text-lead text-chalk">Arrange the board</p>
          <div className="grid gap-2">
            {axisRows.map(({ axis, name, value }) => (
              <label key={axis} className="grid grid-cols-[56px_1fr] items-center gap-3 text-small text-chalk-2">
                {name}
                <select
                  value={value}
                  onChange={(e) => chooseAxis(axis, e.target.value as FlavorDim)}
                  className="h-9 min-w-[132px] cursor-pointer rounded-md bg-board-high px-2.5 text-small font-medium text-chalk shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14)] outline-none transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.3)]"
                >
                  {DIMS.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* What the marks mean */}
      <p
        className="pointer-events-none absolute left-4 z-10 max-w-[260px] text-small leading-relaxed text-chalk-2 max-md:hidden"
        style={{ bottom: 20 + panelInsets.bottom }}
      >
        {hasSelection ? 'Arcs reach from each chosen spice to its six strongest recipe partners, tinted by where they start.' : ''}
      </p>
    </div>
  );
}
