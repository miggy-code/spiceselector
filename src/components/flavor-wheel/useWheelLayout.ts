import { useMemo } from "react";
import { hierarchy, partition, HierarchyRectangularNode } from "d3-hierarchy";
import { arc as d3Arc } from "d3-shape";
import type { FlavorNode } from "@/types/spice";

export interface ArcDescriptor {
  id: string;
  name: string;
  level: FlavorNode["level"];
  familyId: string;
  path: string;
  centroidAngle: number;
  centroidRadius: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  description?: string;
}

const INNER_RADIUS = 60;
const RING_WIDTH = 70;

function levelToRing(level: string): number {
  switch (level) {
    case "family":
      return 0;
    case "subcategory":
      return 1;
    case "spice":
      return 2;
    default:
      return -1;
  }
}

export function useWheelLayout(
  data: FlavorNode,
  size: number,
  intensityMap?: Map<string, number>
): ArcDescriptor[] {
  return useMemo(() => {
    const root = hierarchy(data)
      .sum((d) => {
        // Use intensity from map if available, otherwise default to 1
        if (intensityMap && d.level === "spice") {
          return intensityMap.get(d.name) ?? 1;
        }
        return 1;
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const partitionLayout = partition<FlavorNode>().size([2 * Math.PI, 3]);

    partitionLayout(root);

    const nodes = root.descendants() as HierarchyRectangularNode<FlavorNode>[];

    const arcGenerator = d3Arc<HierarchyRectangularNode<FlavorNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => {
        const ring = levelToRing(d.data.level);
        return ring >= 0 ? INNER_RADIUS + ring * RING_WIDTH : 0;
      })
      .outerRadius((d) => {
        const ring = levelToRing(d.data.level);
        return ring >= 0 ? INNER_RADIUS + (ring + 1) * RING_WIDTH - 2 : 0;
      })
      .padAngle(0.01);

    return nodes
      .filter((d) => d.data.level !== "root")
      .map((d) => {
        // Find the family ancestor
        let familyNode = d;
        while (familyNode.depth > 1 && familyNode.parent) {
          familyNode = familyNode.parent as HierarchyRectangularNode<FlavorNode>;
        }

        const ring = levelToRing(d.data.level);
        const innerR = INNER_RADIUS + ring * RING_WIDTH;
        const outerR = INNER_RADIUS + (ring + 1) * RING_WIDTH - 2;
        const midAngle = (d.x0 + d.x1) / 2;
        const midRadius = (innerR + outerR) / 2;

        return {
          id: d.data.id,
          name: d.data.name,
          level: d.data.level,
          familyId: familyNode.data.id,
          path: arcGenerator(d) ?? "",
          centroidAngle: midAngle,
          centroidRadius: midRadius,
          x0: d.x0,
          x1: d.x1,
          y0: d.y0,
          y1: d.y1,
          description: d.data.description,
        };
      });
  }, [data, size, intensityMap]);
}

export { INNER_RADIUS, RING_WIDTH };
