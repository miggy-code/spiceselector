"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/types/database";

type Snapshot = { blends: Tables<"saved_blends">[]; rack: string[]; recipes: Tables<"recipes">[] };
type CloudState = Snapshot & {
  user: User | null; authReady: boolean; ready: boolean; busy: boolean;
  error: string | null; refresh: () => Promise<void>;
  write: (operation: (client: ReturnType<typeof createClient>, userId: string) => PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;
};
const CloudContext = createContext<CloudState | null>(null);
const empty: Snapshot = { blends: [], rack: [], recipes: [] };

export function CloudProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => supabaseConfigured ? createClient() : null);
  const [auth, setAuth] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: !supabaseConfigured });
  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setAuth({ user: session?.user ?? null, ready: true });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);
  return <AccountCloud key={auth.user?.id ?? "guest"} user={auth.user} authReady={auth.ready} client={client}>{children}</AccountCloud>;
}

function AccountCloud({ user, authReady, client, children }: { user: User | null; authReady: boolean; client: ReturnType<typeof createClient> | null; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [ready, setReady] = useState(!user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!user || !client) return;
    const version = ++generation.current;
    try {
      const [blends, rack, recipes] = await Promise.all([
        client.from("saved_blends").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        client.from("spice_racks").select("slugs").eq("user_id", user.id).maybeSingle(),
        client.from("recipes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      const failure = blends.error || rack.error || recipes.error;
      if (failure) throw failure;
      if (!mounted.current || version !== generation.current) return;
      setSnapshot({ blends: blends.data ?? [], rack: rack.data?.slugs ?? [], recipes: recipes.data ?? [] });
      setReady(true);
      setError(null);
    } catch (failure) {
      if (mounted.current && version === generation.current) setError(`Could not load your kitchen. ${message(failure)}`);
    }
  }, [client, user]);

  useEffect(() => {
    const sync = () => { if (!locked.current && document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    const timer = window.setInterval(sync, 30000);
    return () => { window.removeEventListener("focus", sync); window.removeEventListener("online", sync); window.clearInterval(timer); };
  }, [refresh]);

  const write: CloudState["write"] = async (operation) => {
    if (!user || !client || !ready || locked.current) return false;
    locked.current = true;
    generation.current++;
    setBusy(true);
    setError(null);
    try {
      const result = await operation(client, user.id);
      if (result.error) throw result.error;
      await refresh();
      return true;
    } catch (failure) {
      if (mounted.current) setError(`Not saved. ${message(failure)} Please try again.`);
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return <CloudContext.Provider value={{ ...snapshot, user, authReady, ready, busy, error, refresh, write }}>{children}</CloudContext.Provider>;
}

function message(error: unknown) {
  return typeof error === "object" && error && "message" in error ? String(error.message) : "Check your connection.";
}

export function useCloud() {
  const context = useContext(CloudContext);
  if (!context) throw new Error("useCloud must be used inside CloudProvider");
  return context;
}

export type RecipeInput = Pick<TablesInsert<"recipes">, "title" | "ingredients" | "instructions" | "slugs">;
