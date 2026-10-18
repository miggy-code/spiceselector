"use client";

import dynamic from "next/dynamic";
import { configureCatalog, type CatalogSnapshot } from "@/lib/catalog-runtime";
import type { SpiceProfile } from "@/types/spice";

const MapClientLoader = dynamic(() => import("./MapClientLoader"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-chalk-2">Loading the catalog…</p>,
});

export default function CatalogShell({ data, catalog }: { data: SpiceProfile[]; catalog: CatalogSnapshot }) {
  // Synchronous catalog consumers belong to this browser, never the server process.
  if (typeof window !== "undefined") configureCatalog(catalog);
  return <MapClientLoader data={data} />;
}
