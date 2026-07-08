"use client";

import { SelectionProvider } from "@/context/SelectionContext";
import Header from "./Header";
import FlavorWheel from "./flavor-wheel/FlavorWheel";
import WheelLegend from "./flavor-wheel/WheelLegend";
import SelectedSpiceChips from "./flavor-wheel/SelectedSpiceChips";
import PairingSidebar from "./pairing/PairingSidebar";

export default function SpiceSelectionApp() {
  return (
    <SelectionProvider>
      <div className="flex flex-col h-screen bg-white dark:bg-neutral-900">
        <Header />
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] overflow-hidden">
          {/* Wheel section */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <FlavorWheel />
            </div>
            <WheelLegend />
            <SelectedSpiceChips />
          </div>

          {/* Sidebar */}
          <div className="border-t lg:border-t-0 lg:border-l border-neutral-200 dark:border-neutral-800 overflow-y-auto">
            <PairingSidebar />
          </div>
        </main>
      </div>
    </SelectionProvider>
  );
}
