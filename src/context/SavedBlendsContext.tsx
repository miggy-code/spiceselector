"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCloud } from "@/context/CloudContext";
import { createLocalStore } from "@/lib/local-store";

/**
 * Guest blends stay in browser storage; authenticated blends come from Supabase.
 */

const STORAGE_KEY = "spice-blends";

export interface SavedBlend {
  id: string;
  name: string;
  slugs: string[];
  createdAt: number;
}

interface SavedBlendsState {
  blends: SavedBlend[];
  saveBlend: (name: string, slugs: string[]) => Promise<SavedBlend | null>;
  deleteBlend: (id: string) => Promise<void>;
}

const SavedBlendsContext = createContext<SavedBlendsState | null>(null);

const NO_BLENDS: SavedBlend[] = [];

function isSavedBlend(value: unknown): value is SavedBlend {
  if (typeof value !== "object" || value === null) return false;
  const blend = value as Partial<SavedBlend>;
  return (
    typeof blend.id === "string" &&
    typeof blend.name === "string" &&
    Array.isArray(blend.slugs) &&
    blend.slugs.every((slug) => typeof slug === "string") &&
    typeof blend.createdAt === "number" &&
    Number.isFinite(blend.createdAt)
  );
}

const blendsStore = createLocalStore<SavedBlend[]>(
  STORAGE_KEY,
  NO_BLENDS,
  (raw) => {
    const blends: unknown = JSON.parse(raw);
    if (!Array.isArray(blends)) throw new Error("corrupt blends");
    return blends.filter(isSavedBlend);
  },
  (blends) => JSON.stringify(blends)
);

export function SavedBlendsProvider({ children }: { children: ReactNode }) {
  // Server render + first hydration pass see no blends; stored blends swap in
  // on the client (see createLocalStore), so markup matches.
  const cloud = useCloud();
  const localBlends = useSyncExternalStore(
    blendsStore.subscribe,
    blendsStore.getSnapshot,
    blendsStore.getServerSnapshot
  );

  const blends = cloud.user ? cloud.blends.map((b) => ({
    id: b.id, name: b.name, slugs: b.slugs, createdAt: Date.parse(b.created_at),
  })) : localBlends;

  async function saveBlend(name: string, slugs: string[]) {
    if (!cloud.authReady) return null;
    const blend: SavedBlend = { id: crypto.randomUUID(), name: name.trim() || "Untitled blend", slugs, createdAt: Date.now() };
    if (cloud.user) {
      const saved = await cloud.write((client, userId) => client.from("saved_blends").insert({
        id: blend.id, user_id: userId, name: blend.name, slugs, created_at: new Date(blend.createdAt).toISOString(),
      }));
      return saved ? blend : null;
    }
    blendsStore.update((prev) => [blend, ...prev]);
    return blend;
  }

  async function deleteBlend(id: string) {
    if (!cloud.authReady) return;
    if (cloud.user) {
      await cloud.write((client, userId) => client.from("saved_blends").delete().eq("id", id).eq("user_id", userId));
    } else blendsStore.update((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <SavedBlendsContext.Provider value={{ blends, saveBlend, deleteBlend }}>
      {children}
    </SavedBlendsContext.Provider>
  );
}

export function useSavedBlends() {
  const context = useContext(SavedBlendsContext);
  if (!context) {
    throw new Error("useSavedBlends must be used within a SavedBlendsProvider");
  }
  return context;
}
