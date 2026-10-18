import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { CatalogSnapshot } from "./catalog-runtime";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const loadCatalog = unstable_cache(async (): Promise<CatalogSnapshot> => {
  if (!url || !key) throw new Error("Supabase is not configured.");
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("catalog_snapshot", {});
  if (error) throw new Error(`The catalog could not be loaded: ${error.message}`);
  if (!data || typeof data !== "object") throw new Error("The catalog returned no data.");
  return data as unknown as CatalogSnapshot;
}, ["catalog-snapshot-v1"], { revalidate: 300, tags: ["catalog"] });
export function getCatalogSnapshot() { return loadCatalog(); }
