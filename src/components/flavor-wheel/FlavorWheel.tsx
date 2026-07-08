"use client";

import { useCallback, useState, useMemo } from "react";
import { useWheelLayout, INNER_RADIUS } from "./useWheelLayout";
import WheelArc from "./WheelArc";
import { useSelection } from "@/context/SelectionContext";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { spiceName } from "@/lib/spice-list";
import flavorVectorsData from "@/data/flavor-vectors.json";
import taxonomyData from "@/data/spice-taxonomy.json";
import type { FlavorNode } from "@/types/spice";

// Spice display name → intensity, from the local flavor-vector data.
const intensityByName = new Map<string, number>(
  Object.entries(flavorVectorsData as Record<string, { intensity: number }>).map(
    ([id, v]) => [spiceName(id), v.intensity]
  )
);

export default function FlavorWheel() {
  const { selectedSpiceIds, hoveredSpiceId, toggleSpice, setHovered } =
    useSelection();
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<{
    text: string;
    description?: string;
    x: number;
    y: number;
  } | null>(null);
  const svgSize = Math.min(containerSize.width || 500, containerSize.height || 500, 600);
  const arcs = useWheelLayout(taxonomyData as FlavorNode, svgSize, intensityByName);
  const hasSelection = selectedSpiceIds.size > 0;

  const handleHover = useCallback(
    (id: string | null) => {
      setHovered(id);
      if (id) {
        const arc = arcs.find((a) => a.id === id);
        if (arc) {
          const x = Math.cos(arc.centroidAngle - Math.PI / 2) * arc.centroidRadius;
          const y = Math.sin(arc.centroidAngle - Math.PI / 2) * arc.centroidRadius;
          setTooltip({ text: arc.name, description: arc.description, x, y });
        }
      } else {
        setTooltip(null);
      }
    },
    [arcs, setHovered]
  );

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full h-full min-h-[400px]">
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
      >
        {/* Center label */}
        <text
          textAnchor="middle"
          dy="0.35em"
          className="fill-neutral-600 dark:fill-neutral-300 text-sm font-medium pointer-events-none select-none"
        >
          {hasSelection
            ? `${selectedSpiceIds.size} selected`
            : "Select spices"}
        </text>

        {/* Arcs grouped by ring for proper layering */}
        <g>
          {arcs
            .filter((a) => a.level === "family")
            .map((arc) => (
              <WheelArc
                key={arc.id}
                arc={arc}
                isSelected={false}
                isHovered={hoveredSpiceId === arc.id}
                hasSelection={hasSelection}
                onSelect={toggleSpice}
                onHover={handleHover}
              />
            ))}
        </g>
        <g>
          {arcs
            .filter((a) => a.level === "subcategory")
            .map((arc) => (
              <WheelArc
                key={arc.id}
                arc={arc}
                isSelected={false}
                isHovered={hoveredSpiceId === arc.id}
                hasSelection={hasSelection}
                onSelect={toggleSpice}
                onHover={handleHover}
              />
            ))}
        </g>
        <g>
          {arcs
            .filter((a) => a.level === "spice")
            .map((arc) => (
              <WheelArc
                key={arc.id}
                arc={arc}
                isSelected={selectedSpiceIds.has(arc.id)}
                isHovered={hoveredSpiceId === arc.id}
                hasSelection={hasSelection}
                onSelect={toggleSpice}
                onHover={handleHover}
              />
            ))}
        </g>

        {/* Arc labels for family ring */}
        {arcs
          .filter((a) => a.level === "family")
          .map((arc) => {
            const angle = (arc.x0 + arc.x1) / 2;
            const r = INNER_RADIUS + 35;
            const x = Math.cos(angle - Math.PI / 2) * r;
            const y = Math.sin(angle - Math.PI / 2) * r;
            // Flip text on the bottom half so it's not upside down
            const degrees = (angle * 180) / Math.PI;
            const rotate = degrees > 90 && degrees < 270
              ? degrees + 180
              : degrees;

            return (
              <text
                key={`label-${arc.id}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${rotate}, ${x}, ${y})`}
                className="fill-white text-[9px] font-semibold pointer-events-none select-none"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
              >
                {arc.name}
              </text>
            );
          })}

        {/* Tooltip */}
        {tooltip && (
          <g transform={`translate(${tooltip.x}, ${tooltip.y})`} className="pointer-events-none">
            <rect
              x={-60}
              y={-36}
              width={120}
              height={tooltip.description ? 40 : 24}
              rx={6}
              className="fill-neutral-900/90 dark:fill-neutral-100/90"
            />
            <text
              textAnchor="middle"
              y={-20}
              className="fill-white dark:fill-neutral-900 text-[11px] font-semibold"
            >
              {tooltip.text}
            </text>
            {tooltip.description && (
              <text
                textAnchor="middle"
                y={-6}
                className="fill-neutral-300 dark:fill-neutral-600 text-[8px]"
              >
                {tooltip.description.length > 30
                  ? tooltip.description.slice(0, 28) + "…"
                  : tooltip.description}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
