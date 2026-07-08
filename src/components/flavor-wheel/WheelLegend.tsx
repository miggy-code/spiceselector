"use client";

import { FAMILY_COLORS } from "@/lib/colors";

const families = [
  { id: "warm", name: "Warm" },
  { id: "hot-pungent", name: "Hot & Pungent" },
  { id: "sweet", name: "Sweet" },
  { id: "earthy", name: "Earthy" },
  { id: "herbal", name: "Herbal" },
  { id: "floral", name: "Floral" },
  { id: "citrus-bright", name: "Citrus & Bright" },
  { id: "umami-savory", name: "Umami & Savory" },
];

export default function WheelLegend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-4 py-2">
      {families.map((f) => (
        <div key={f.id} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full inline-block flex-shrink-0"
            style={{ backgroundColor: FAMILY_COLORS[f.id] }}
          />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            {f.name}
          </span>
        </div>
      ))}
    </div>
  );
}
