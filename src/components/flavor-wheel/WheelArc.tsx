"use client";

import { motion } from "framer-motion";
import type { ArcDescriptor } from "./useWheelLayout";
import { ringColor, selectedColor } from "@/lib/colors";

interface WheelArcProps {
  arc: ArcDescriptor;
  isSelected: boolean;
  isHovered: boolean;
  hasSelection: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export default function WheelArc({
  arc,
  isSelected,
  isHovered,
  hasSelection,
  onSelect,
  onHover,
}: WheelArcProps) {
  const isSpice = arc.level === "spice";
  const baseColor = ringColor(arc.familyId, arc.level as "family" | "subcategory" | "spice");
  const fillColor = isSelected ? selectedColor(arc.familyId) : baseColor;

  // Dim non-selected arcs when something is selected
  const opacity = hasSelection && !isSelected && !isHovered ? 0.35 : 1;

  return (
    <motion.path
      d={arc.path}
      fill={fillColor}
      stroke={isSelected ? "#fff" : isHovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)"}
      strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0.5}
      opacity={opacity}
      style={{ cursor: isSpice ? "pointer" : "default" }}
      onClick={isSpice ? () => onSelect(arc.id) : undefined}
      onMouseEnter={() => onHover(arc.id)}
      onMouseLeave={() => onHover(null)}
      initial={false}
      animate={{
        opacity,
        scale: isSelected ? 1.02 : 1,
      }}
      transition={{ duration: 0.2 }}
    />
  );
}
