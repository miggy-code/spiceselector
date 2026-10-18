# Spice Selector

[![CI](https://github.com/miggy-code/spiceselector/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/miggy-code/spiceselector/actions/workflows/ci.yml)

**A visual guide to how spices relate through flavor, chemistry, and cooking.**

Spice Selector turns flavor data into an interactive tool for exploring 86 spices. Move between a 3D flavor map and a 2D atlas, inspect evidence behind pairing suggestions, and compare possible substitutions. The flavor explorer reads its catalog from Supabase; optional accounts add saved recipes and sync personal blends and spice racks across devices. See [catalog data and verification](docs/catalog-migration.md).

## What you can explore

- **Flavor map:** Arrange spices across warmth, brightness, earthiness, florality, and heat. Select a spice to see its strongest recipe-affinity relationships.
- **Flavor atlas:** Explore neighborhoods across all five dimensions at once, or compare two dimensions directly. Switch between map and atlas with an animated transition.
- **Pairing evidence:** See suggestions ranked against selected spices, with per-pair recipe, chemistry, and curated evidence available in the explanation.
- **Substitutions:** Compare flavor-profile similarity, shared chemistry, taxonomy, and recipe affinity, with guidance for adjusting a replacement's intensity.
- **Blend and dish tools:** Build and share blends, save favorites, browse classic blends, find a bridge between two spices, or explore spices used with a dish.
- **Personalization:** Search the spice catalog, filter by cuisine or heat, and mark spices in your rack. Guests save blends and racks in the browser; signed-in users save them to their account.

## How recommendations work

Pairing and substitution are separate ranking problems. A spice can pair well with another while tasting very different from it, so the app uses different signals for each.

Pairing scores blend three signals: recipe affinity from [FlavorGraph](https://github.com/lamypark/FlavorGraph), compound overlap from FooDB, USDA Dr. Duke's, and FlavorDB2, and a curated pairing label. The nominal weights are 0.6, 0.2, and 0.2; when a signal is unavailable for a pair, the remaining weights are renormalized. The interface exposes the evidence that contributed to each suggestion.

Substitution scores combine five-axis profile similarity (0.4), compound overlap (0.25), taxonomy proximity (0.2), and recipe affinity (0.15), again renormalizing when data is missing. Taxonomy-only candidates are dampened so a shared family does not imply a perfect replacement.

These scores are decision aids, not taste measurements. Flavor profiles are generated and reviewed estimates; recipe co-occurrence does not establish that every cook will enjoy a pairing; and shared molecules alone do not prove that two ingredients taste good together. Coverage varies by spice and data source, and the app shows which evidence is available.

## Run locally

### Requirements

- Node.js 22 or newer
- npm

```bash
git clone https://github.com/miggy-code/spiceselector.git
cd spiceselector
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and enter your Supabase project URL and publishable key, then open [http://localhost:3000](http://localhost:3000). The configured database must contain the catalog; see [catalog data and verification](docs/catalog-migration.md).

Useful project checks:

```bash
npm run lint
npm run build
npm start
```

The data-generation workflow is documented separately in [`ingestion/README.md`](ingestion/README.md). Regenerating datasets may require third-party source files or API credentials; that pipeline is not needed to run the app.

## Supabase

Supabase clients are configured for browser and server use with cookie-based
sessions. Copy `.env.example` to `.env.local` (or add its variables to your
existing file), then enter the project URL and publishable key from the Supabase
dashboard's Connect dialog. Set the same variables in your deployment environment.
Never put a service role or secret key in a `NEXT_PUBLIC_` variable.

In Client Components:

```ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
```

In Server Components, Server Actions, and Route Handlers:

```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
```

`src/proxy.ts` refreshes authentication cookies. Protected routes must verify
identity using `supabase.auth.getClaims()` or `getUser()` and handle errors;
the proxy itself does not restrict access. Enable Row Level Security and add
appropriate policies before exposing any database tables through these clients.

The connected project has `saved_blends` and `spice_racks` tables with Row Level
Security policies restricting access to each authenticated user's own rows.
Schema migrations are kept in `supabase/migrations/`, and generated database types
are in `src/types/database.ts`. Both client helpers use these types.

Open **My kitchen** in the header to create an account or sign in with email and
password. Confirm your signup email before signing in. You can resend confirmation
from the same form. Sign-out clears account state from the UI and returns to the
browser's guest blends and rack.

Signed-in blends and rack changes save directly to Supabase. Recipes support a
name, ingredients with quantities, instructions, and linked spices from the current
map selection; create, view, edit, load spices, and delete them in My kitchen.
Changes appear on other devices within 30 seconds, on window focus, or via Refresh.
Failed requests show an error and preserve recipe drafts. Offline cloud edits are
not queued: reconnect and retry. Browser data imports explicitly via **Import browser
blends & rack**; imports can be retried without duplicating blends, and rack spices
are merged atomically. Browser originals remain available to guests.

In Supabase Authentication > URL Configuration, set the production Site URL and
allow `http://localhost:3000/auth/callback` plus your deployed origin's
`/auth/callback`. The PKCE callback exchanges email confirmation codes for cookie
sessions. If using a custom token-hash signup email template, target
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` instead.
Configure SMTP for delivery to real users; Supabase's default email service has
recipient and rate restrictions. Auth settings and email delivery are managed in
the Supabase dashboard; schema migrations do not configure them.

Apply committed migrations to any fresh Supabase project in filename order.
The rack RPCs use SECURITY INVOKER and authenticated-only grants; all personal
tables use Row Level Security. Spice datasets remain committed JSON.
See the [Supabase Next.js guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).

## Implementation

- **Next.js 16, React 19, TypeScript:** application shell, routing, and interactive views
- **Three.js / React Three Fiber:** 3D map, camera controls, and map-to-atlas morph
- **D3:** 2D atlas and data visualizations
- **Framer Motion:** interface transitions and focused feedback
- **Python and TypeScript ingestion scripts:** source-data processing and committed static outputs
- **Supabase Auth / Postgres:** public spice catalog and evidence, account sessions, saved recipes, blends, and racks with per-user access policies
- **Browser storage:** guest blends, rack inventory, and display preferences

The app is organized around small ranking and data modules in `src/lib/` and visual and interaction components in `src/components/`. Catalog data comes from the cached Supabase server layer; files in `src/data/` remain historical migration inputs. Typed Supabase client helpers live in `src/lib/supabase/`; signed-in personal data is persisted in Supabase, with browser storage for guests.

## Data and attribution

Spice Selector is an independent project inspired by the ingredient-and-molecule exploration in FlavorDB. It is not affiliated with or endorsed by the FlavorDB team.

The current collection has **86 taxonomy ingredients and 86 profiles**, including mint,
curry leaf, asafoetida, ajwain, black cardamom, annatto, epazote, huacatay, ají amarillo,
ají panca, rocoto, juniper berry and summer savory. Molecule-derived aroma fingerprints
cover 58/86 (43 exact ingredient mappings, 15 approximate); absent evidence is explicit.
Recipe embeddings cover 73/86, compound-overlap evidence 72/86, and empirical cuisine
frequencies 39/86. See the [expansion report](docs/research/spice-expansion-2026-10-17.md)
and [library evaluations](docs/research/flavordb-kew-evaluation.md).


- **FlavorDB / FlavorDB2:** Garg et al., [“FlavorDB: a database of flavor molecules”](https://doi.org/10.1093/nar/gkx957), *Nucleic Acids Research* (2018); [FlavorDB2](https://cosylab.iiitd.edu.in/flavordb2/). Relevant derived FlavorDB2 data is distributed under [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).
- **FlavorGraph:** Recipe relationships and embeddings from [lamypark/FlavorGraph](https://github.com/lamypark/FlavorGraph), licensed under Apache-2.0.
- **FooDB:** Compound and flavor annotations from [foodb.ca](https://foodb.ca/), subject to FooDB's terms. FooDB data is provided for non-commercial use; commercial use requires permission from its authors.
- **USDA Dr. Duke's:** Phytochemical information from the [USDA Dr. Duke's Phytochemical and Ethnobotanical Databases](https://phytochem.nal.usda.gov/).
- **CulinaryDB:** Recipe and cuisine-frequency data attributed to CoSyLab, IIIT-Delhi, and Ganesh Bagler, distributed under CC BY-NC-SA 3.0.
- **Flavor profiles:** Five-axis profiles and some descriptive fields were generated with Google Gemini or locally authored by Luna subagents and reviewed for this project. Provenance distinguishes authored estimates from source observations; these are not laboratory measurements.

The source-specific restrictions also apply to relevant derived data in this repository. Review the linked terms before reusing the datasets, especially for commercial purposes. The application code is released under the [MIT License](LICENSE). The datasets keep their source licenses, which include non-commercial terms (CC BY-NC-SA 3.0 and FooDB terms); the MIT License does not apply to them.

## Repository map

```text
src/
  app/            Next.js route, layout, and global styles
  components/     Maps, search, filters, substitution and pairing tools
  context/        Selection, rack, and saved-blend state
  data/           Taxonomy, profiles, and generated evidence datasets
  lib/            Ranking, substitution, blend, and flavor utilities
ingestion/        Data ingestion and generation scripts
docs/             Data notes, analyses, and source documentation
```
