# Catalog data

The app reads the existing Supabase `catalog_snapshot()` function using the public
publishable key. That function assembles the catalog from normalized `catalog_*`
tables. The server caches the result for five minutes; reload the app after that
cache refresh to see edits. No deployment is needed for future catalog edits.

Classic blends live in `catalog_classic_blends`; their ordered spice memberships
live in `catalog_classic_blend_spices`. The starter list shows all database blends
in catalog order. Personal user blends remain in `saved_blends`.

The two catalog SQL files in `supabase/migrations/` were recovered directly from
the hosted migration history, with their applied versions. They are already
applied to the configured project. Do not reapply them or reimport JSON over live
catalog edits. Keep these files for schema replay in new environments. The JSON
files remain historical migration inputs and are never read by the running app.

Run the read-only regression and live guest access check from the repository root:

```sh
node scripts/check-catalog.mjs
```

It uses `.env.local` or existing environment variables and requires only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. To also
compare all imported data, ordering, and memberships with the original inputs:

```sh
node scripts/check-catalog.mjs --compare-inputs
```

The comparison is intended for migration verification. Intentional later database
edits will differ from those historical inputs. Neither command writes data.
On networks requiring an environment proxy, use Node 24's `--use-env-proxy` flag.

When Supabase is unavailable or empty, the page shows an unavailable message and
a retry button. It does not silently load the old files. Guest exploration needs
no login; account data continues to use its existing user policies.
