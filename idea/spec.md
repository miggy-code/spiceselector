# Spice Pairing Tool – Complete Product Specification

## 1. PRODUCT OVERVIEW

**Goal:** Help chefs (professional and home) understand spice pairings through visualization, theory, and practical application. Combine flavor science with culinary tradition and real-world ingredient networks.

**Core Insight:** Spices work together when they share aromatic compounds (chemistry) and have been validated through culinary tradition (culture). Show both layers.

**Primary Use Cases:**
- **Exploration:** Chef wants to understand spice pairing theory and expand their toolkit
- **Reference:** Chef is mid-recipe and wants to validate a pairing or find an alternative
- **Inspiration:** Chef has an ingredient and wants to discover spice combinations that work with it

---

## 2. FEATURE SET

### 2.1 Flavor Space Map (Primary View)

**Feature: Interactive 2D Flavor Map**

- **Visual:** Spices plotted as draggable nodes on a 2D space
  - **X-axis:** Warm (left) ↔ Cool/Fresh (right)
  - **Y-axis:** Earthy/Heavy (bottom) ↔ Bright/Floral (top)
  - **Visual encoding:** 
    - Node size = intensity/potency
    - Node color = flavor family (warm spices warm hue, cool spices cool hue)
    - Glow intensity = how commonly used
    - Opacity = confidence level (from data vs. empirical validation)

- **Interactions:**
  - Hover spice → tooltip with flavor profile, heat level, origin, common uses
  - Click spice → expand to show:
    - Detailed aromatic compound breakdown
    - Top 5 "natural pairings" (closest nodes + high culinary validation)
    - Risky pairings (far away but sometimes work—experimental)
    - Dishes/cuisines where it shines
    - Typical quantity range
    - Substitute spices
  - Drag spice node → temporarily reposition for exploration (non-persistent)
  - Filter by:
    - Cuisine (Indian, Chinese, Middle Eastern, European, Latin American, Southeast Asian, African)
    - Heat level (mild, medium, hot)
    - Flavor family (warm, cool, citrusy, earthy, floral, peppery, etc.)
    - Usage frequency (common, specialty, rare)
    - Price tier (affordable, moderate, premium)

- **"Recipe Mode" Overlay:**
  - User selects a dish type or primary ingredient
  - Map highlights foundational spices (solid color)
  - Secondary spices appear dimmed
  - Incompatible or risky spices appear as faded nodes
  - Edges show connections: solid = validated, dashed = experimental, red = avoid
  - User can toggle nodes on/off to build a spice blend, see real-time feedback on the blend profile

---

### 2.2 Ingredient Network Graph (Secondary View)

**Feature: Force-Directed Ingredient Graph**

- **Visual:** Network graph of ~200–500 common ingredients (spices, proteins, aromatics, herbs)
  - Nodes = ingredients
  - Edges = co-occurrence in recipes (weighted by frequency)
  - Node color = ingredient category (spices, proteins, aromatics, alliums, acids, fats, etc.)
  - Node size = usage frequency across recipes
  - Edge thickness = strength of pairing in culinary tradition

- **Data Source:** 
  - Pulled from an external API (e.g., Spoonacular Recipes API, Edamam, or custom-scraped recipe database)
  - Aggregated across 50K+ recipes (multiple cuisines)
  - Normalized to remove outliers

- **Interactions:**
  - Search ingredient → highlights node and all connected ingredients
  - Click ingredient → see:
    - Top 10 ingredients it co-occurs with
    - Cuisine breakdown (% usage in each cuisine)
    - Typical quantity in recipes
    - Price/availability
  - Drag to explore the graph; physics simulation keeps clusters tight
  - Filter by:
    - Cuisine
    - Ingredient category
    - Price range
    - Dietary restrictions (vegan, gluten-free, etc.)
  - "Swap mode": Click an ingredient in your recipe → see alternatives ranked by similarity (flavor proximity + network similarity)

- **API Integration:**
  - Backend fetches and caches recipe data daily
  - Computes co-occurrence matrix
  - Serves pre-computed force layout coordinates (to avoid expensive layout calcs on client)
  - Returns top N neighbors per ingredient for performance

---

### 2.3 Blend Builder

**Feature: Interactive Spice Blend Creator**

- **Workflow:**
  1. User selects a dish type (braised short ribs, curry, stir-fry, etc.) or starts blank
  2. Tool suggests a foundational blend or user picks spices manually
  3. For each spice added:
     - Flavor map highlights its region
     - Blend profile (on a radar chart or similar) updates in real-time showing: warmth, brightness, earthiness, floral, heat
     - "Compatibility score" shows how well the blend is balanced (0–100)
     - Warnings if incompatible spices are detected
  4. User adjusts ratios (drag sliders or type quantities)
  5. "Save Blend" → stores to local storage or account
  6. "Export" → recipe card, shopping list, or JSON

- **Visual Feedback:**
  - Radar chart showing blend profile as user adds spices
  - Compatibility warnings in real-time
  - Suggested additions ("Try adding cardamom to brighten this")
  - Estimated cost & sourcing links

---

### 2.4 Discovery & Learning

**Feature: Spice Library**

- **Individual Spice Pages:**
  - Full profile: origin, history, botanical name, flavor notes
  - Aromatic compound breakdown (visual breakdown of key volatiles)
  - Common pairings (from map + validation data)
  - Recipes that feature it prominently
  - Substitutes ranked by similarity
  - Storage & freshness tips
  - Sourcing/supplier recommendations (links to Kalustyan's, Penzey's, etc.)

**Feature: Pairing Rules Reference**

- **Explainer Cards:**
  - "Why garam masala works" → shared compounds between cardamom, cinnamon, clove, cumin
  - "Warm + bright = depth" → theory explanation with examples
  - "Regional combinations that work" → historical/cultural pairings with context
  - "Aromatics as bridges" → how to use intermediate spices to connect distant ones

**Feature: Cuisine Guides**

- Per-cuisine overview showing:
  - Foundational spice palette (top 5–10)
  - Common flavor profiles
  - Regional variations
  - Signature blends (garam masala, ras el hanout, Chinese five-spice, etc.)
  - Dish-to-spice pairings

---

### 2.5 Practical Tools

**Feature: Recipe Analyzer**

- User pastes recipe text or URL
- Backend parses ingredients
- Tool shows:
  - Spice breakdown on flavor map
  - Predicted flavor profile
  - Suggested substitutions if any spices are unavailable/expensive
  - Comparative analysis: "This is similar to [X cuisine]"

**Feature: Shopping List**

- From a saved blend or recipe:
  - Generate formatted shopping list
  - Link to suppliers (bulk spice retailers, local options)
  - Price aggregator (fetch from APIs or manual input)
  - Quantity suggestions for home cooks vs. professionals

---

## 3. USER STORIES

### Exploration & Learning

**Story 1: Home cook wants to expand beyond basic spices**
- Visits flavor map
- Filters to "beginner-friendly" + "warm spices"
- Clicks on cumin, sees it pairs naturally with coriander, sees garam masala as a next step
- Reads pairing rules explainer
- Discovers new spices to try

**Story 2: Chef researches a cuisine they're unfamiliar with**
- Clicks "Cuisine Guide" → selects Indian
- Sees foundational spices and how they relate on the map
- Explores regional variations
- Downloads a spice shopping list

### Practical Application

**Story 3: Mid-recipe substitution**
- Recipe calls for fenugreek; chef doesn't have it
- Opens tool, searches "fenugreek"
- Sees alternatives ranked by flavor similarity
- Swaps it, recalculates blend profile to ensure it still works
- Cooks with confidence

**Story 4: Creating a signature spice blend**
- Opens blend builder
- Selects "braised beef" as starting point
- Manually adds/removes spices, adjusting ratios
- Real-time feedback shows compatibility and flavor profile
- Saves blend to account
- Later, uses the same blend across multiple recipes

### Discovery

**Story 5: Discovering ingredient networks**
- Opens ingredient graph
- Searches "cardamom"
- Sees all ingredients it commonly pairs with
- Filters to Indian cuisine
- Discovers a new protein-spice pairing they hadn't considered
- Finds recipes featuring that combination

**Story 6: Analyzing an unfamiliar recipe**
- Pastes a recipe URL (e.g., from food blog)
- Tool parses ingredients, shows spice distribution on flavor map
- Chef sees: "This is 70% warm, 30% bright—similar to [X cuisine]"
- Gets substitution suggestions for hard-to-find spices

---

## 4. DATA ARCHITECTURE

### 4.1 Core Data Models

```
Spice {
  id: string (unique identifier)
  name: string
  commonNames: string[] (aliases)
  botanicalName: string
  origin: string (region/country)
  flavor: {
    warmth: number (0–100, calibrated)
    brightness: number (0–100)
    earthiness: number (0–100)
    florality: number (0–100)
    heat: number (0–100, Scoville if applicable)
    confidence: number (0.5–1.0, source: science vs. empirical)
  }
  compounds: {
    name: string (e.g., "cineol", "linalool")
    percentage: number (approximate)
    source: string (chemical analysis data)
  }[]
  families: string[] (warm spices, citrusy, peppery, etc.)
  cuisines: {
    cuisine: string
    frequency: "common" | "occasional" | "rare"
    typicalQuantity: string (e.g., "1 tsp per 4 servings")
  }[]
  heat: {
    scoville: number | null
    level: "mild" | "medium" | "hot" | "extreme"
  }
  color: string (hex, for visual encoding)
  substitutes: {
    spiceId: string
    similarity: number (0–1)
    notes: string
  }[]
  sourcing: {
    supplier: string
    pricePerOunce: number
    url: string
  }[]
  storage: {
    shelfLife: string
    conditions: string
  }
  recipes: {
    recipeId: string
    prominenceScore: number (0–1, how central to the recipe)
  }[]
}

Blend {
  id: string
  name: string
  userId: string | null (null = public)
  spices: {
    spiceId: string
    ratioByWeight: number (0–1, sums to 1)
  }[]
  dishType: string | null
  profile: {
    warmth: number
    brightness: number
    earthiness: number
    florality: number
    heat: number
  }
  compatibilityScore: number (0–100)
  createdAt: timestamp
  tags: string[]
  notes: string
}

Ingredient {
  id: string
  name: string
  category: "spice" | "protein" | "aromatic" | "allium" | "acid" | "fat" | "vegetable" | "herb"
  price: number | null (USD per unit)
  cuisines: {
    cuisine: string
    frequency: number (normalized 0–1)
  }[]
}

IngredientPairing {
  ingredientA: string
  ingredientB: string
  coOccurrenceCount: number (across all recipes)
  cuisines: string[]
  strength: number (0–1, normalized by frequency)
}

Recipe {
  id: string
  name: string
  cuisine: string
  ingredients: {
    ingredientId: string
    quantity: number
    unit: string
  }[]
  source: string (URL or source attribution)
}

PairingRule {
  id: string
  name: string
  description: string
  spiceIds: string[] (spices involved)
  culinaryContext: string (when/why this works)
  scienceExplanation: string (aromatic compounds, etc.)
  examples: string[] (dishes that exemplify this rule)
  riskLevel: "safe" | "experimental" | "avoid"
}

User {
  id: string
  email: string
  savedBlends: string[] (blend IDs)
  preferences: {
    favoritesCuisines: string[]
    dietary: string[] (vegan, gluten-free, etc.)
    pricePreference: "budget" | "moderate" | "premium"
  }
  createdAt: timestamp
}
```

### 4.2 Derived/Computed Data

**Flavor Map Coordinates**
- Pre-compute 2D positions for each spice using:
  - Primary axes: warmth (x), brightness (y)
  - Store in cache; regenerate weekly or on manual update
- Allows instant map rendering without client-side layout computation

**Ingredient Network Graph**
- Pre-compute force-directed layout coordinates using D3 or similar
- Cache node positions + edge weights
- Regenerate daily (as recipe data updates)
- Return to client as static JSON for instant rendering

**Compatibility Scoring**
- Algorithm: 
  - Spices close on flavor map (euclidean distance) = high compatibility
  - Spices with shared aromatic compounds = high compatibility
  - Historical co-occurrence in recipes = boost score
  - Score = weighted sum: (0.4 × proximity) + (0.3 × compound overlap) + (0.3 × culinary validation)
  - Return 0–100

**Substitution Ranking**
- For a given spice, rank alternatives by:
  - Flavor distance on map (inverse)
  - Aromatic compound similarity (Jaccard index)
  - Availability/price (if user provides context)
  - Return top 10 sorted by composite similarity

---

## 5. BACKEND ARCHITECTURE

### 5.1 Technology Stack

**Runtime & Language:**
- Node.js (TypeScript)
- Reason: Strong ecosystem for data pipelines, APIs, and JSON handling

**API Framework:**
- Express.js (or Fastify for performance if needed)
- RESTful + optional GraphQL layer for complex queries

**Database:**
- **Primary:** PostgreSQL (spices, blends, users, pairings—relational data)
- **Cache/Search:** Redis (caching computed layouts, session data, real-time features)
- **Document store (optional):** MongoDB for recipe documents (unstructured)

**Data Pipeline:**
- Node.js scripts (scheduled via node-cron or external scheduler like GitHub Actions)
- Fetch recipe data from external APIs
- Process & aggregate into ingredient network
- Compute force-directed layout
- Store in PostgreSQL + cache in Redis

**External APIs:**
- **Recipe Data:** Spoonacular, Edamam, or custom web scraping (with attribution)
- **Price Data:** Optional integration with spice supplier APIs
- **Geolocation:** Optional, for local supplier recommendations

### 5.2 API Endpoints

#### Spice Data

```
GET /api/spices
  - Query: filter by family, cuisine, heat, priceRange
  - Returns: paginated list of spices with minimal fields
  - Cache: Redis (TTL 7 days)

GET /api/spices/:spiceId
  - Returns: full spice profile (flavor, compounds, pairings, recipes, etc.)
  - Cache: Redis (TTL 7 days)

GET /api/spices/:spiceId/pairings
  - Returns: ranked list of compatible spices (with reasoning)
  - Cache: Redis (TTL 7 days)

GET /api/spices/:spiceId/substitutes
  - Returns: ranked substitutes for a spice
  - Cache: Redis (TTL 7 days)

GET /api/flavor-map
  - Returns: all spices with 2D coordinates, color, size encoding
  - Filter by: cuisine, family, heatLevel
  - Cache: Redis (TTL 7 days)
```

#### Ingredient Network

```
GET /api/ingredient-network
  - Returns: nodes (ingredients) + edges (pairings) + pre-computed layout coords
  - Query: filter by cuisine, category, priceRange
  - Pagination: cursor-based (returns top 200–500 nodes by relevance)
  - Cache: Redis (TTL 24 hours)

GET /api/ingredient-network/:ingredientId/neighbors
  - Returns: top 10 co-occurring ingredients with strength scores
  - Cache: Redis (TTL 24 hours)
```

#### Blends

```
POST /api/blends
  - Create a new blend (auth required)
  - Body: { spices: [{spiceId, ratioByWeight}], dishType?, notes? }
  - Returns: blend object with computed profile + compatibility score

GET /api/blends/:blendId
  - Returns: full blend profile

PUT /api/blends/:blendId
  - Update a blend (auth required)

DELETE /api/blends/:blendId
  - Delete a blend (auth required)

GET /api/blends
  - List user's saved blends (auth required)

GET /api/blends/public
  - Browse public blends (paginated, searchable)
```

#### Analysis

```
POST /api/analyze-recipe
  - Input: recipe text or URL
  - Backend: parses ingredients, maps to spices, computes flavor profile
  - Returns: spice breakdown, flavor profile, suggestions
  - Cache: ephemeral (no caching individual recipes)

POST /api/blend-analysis
  - Input: spice blend (list of spices + ratios)
  - Returns: flavor profile, compatibility score, warnings, suggestions
  - No cache (real-time computation)
```

#### Learning Content

```
GET /api/pairing-rules
  - Returns: all pairing rules with explanations
  - Query: filter by cuisine, riskLevel
  - Cache: Redis (TTL 30 days)

GET /api/cuisine-guides/:cuisine
  - Returns: overview, foundational spices, signature blends, examples
  - Cache: Redis (TTL 30 days)

GET /api/spice-library/:spiceId
  - Returns: extended learning content for a spice
  - Cache: Redis (TTL 30 days)
```

#### User & Auth

```
POST /api/auth/signup
  - Create account

POST /api/auth/login
  - Generate JWT

GET /api/user/profile
  - Get user preferences, saved blends (auth required)

PUT /api/user/preferences
  - Update dietary, cuisine, price preferences (auth required)
```

### 5.3 Data Pipeline (Scheduled Jobs)

**Daily Recipe Aggregation Job** (runs at 2 AM UTC)
1. Fetch recipes from external API (Spoonacular, Edamam, or custom scraper)
2. Parse ingredients
3. Build co-occurrence matrix
4. Compute edge weights (strength = co-occurrence count / max)
5. Filter to top 300–500 ingredients by usage frequency
6. Run force-directed layout algorithm (D3-force or similar)
7. Store node coordinates + edges in PostgreSQL
8. Cache layout JSON in Redis
9. Log summary: # recipes fetched, # ingredients, layout time

**Weekly Spice Profile Validation Job** (runs Mondays 3 AM UTC)
1. Review any new spice additions or updates
2. Validate aromatic compound data against scientific sources
3. Check for pairing rule conflicts
4. Update confidence scores
5. Regenerate flavor map coordinates
6. Cache in Redis

**Monthly Analytics Job**
- Track: most-viewed spices, most-saved blends, API performance
- Generate summary for monitoring

---

## 6. FRONTEND ARCHITECTURE

### 6.1 Tech Stack

- **Framework:** Next.js (React) with App Router
- **Visualization:**
  - **Flavor Map:** D3.js or Plotly for 2D scatter + custom interaction layer
  - **Ingredient Network:** D3-force or Sigma.js (WebGL-based for performance)
  - **Blend Profile:** Recharts for radar charts / sparklines
- **Styling:** Tailwind CSS (dark mode support for your electric aesthetic)
- **State Management:** Zustand or React Context (keep it simple)
- **Auth:** NextAuth.js or Auth0

### 6.2 Page Structure

```
/
  ├── / (landing page)
  ├── /explore
  │   ├── /flavor-map (primary visualization)
  │   ├── /ingredient-network (graph view)
  │   └── /spice-library/:spiceId (detail pages)
  ├── /learn
  │   ├── /pairing-rules
  │   ├── /cuisine-guides/:cuisine
  │   └── /spice-chemistry (explainers)
  ├── /tools
  │   ├── /blend-builder
  │   ├── /recipe-analyzer
  │   └── /shopping-list
  ├── /account (auth-gated)
  │   ├── /my-blends
  │   ├── /preferences
  │   └── /history
  └── /public-blends (discover shared blends)
```

---

## 7. DEPLOYMENT & OPERATIONS

### 7.1 Infrastructure

**Hosting:**
- **Frontend:** Vercel (Next.js native, global CDN)
- **Backend:** AWS ECS + RDS (PostgreSQL) or Render.com (simpler, managed)
- **Cache:** Redis Cloud or AWS ElastiCache
- **File Storage (optional):** AWS S3 for recipe images, exported blend PDFs

**DNS & SSL:**
- Cloudflare or Route 53
- Auto-renewing SSL via Let's Encrypt (handled by hosting provider)

**Monitoring & Logging:**
- Sentry for error tracking
- DataDog or CloudWatch for performance monitoring
- Structured logging (Winston or Pino) to CloudWatch/DataDog

### 7.2 Scaling Considerations

**Read-Heavy Workload (Flavor Map, Ingredient Network):**
- Cache aggressively (Redis)
- CDN for static assets (images, pre-computed layouts)
- Database read replicas if needed

**Compute-Heavy Workload (Recipe Parsing, Layout Calculation):**
- Offload to background jobs (Node.js workers or Lambda)
- Pre-compute everything possible (layouts, compatibility scores)
- Avoid real-time force-directed graph calculations on server

**Database Optimization:**
- Index spices by family, cuisine, heat
- Index ingredient pairings by strength (for ranking)
- Partition recipe data by cuisine or date

### 7.3 Cost Optimization

**Data Pipeline:**
- Fetch recipe data incrementally (10K recipes/day) rather than all at once
- Cache intermediate results
- Use batch processing for layout calculations

**API Cost:**
- Spoonacular API: ~$50–100/month for basic plan (5K requests/day)
- Consider caching extensively to reduce API calls

**Storage:**
- PostgreSQL: ~$10–30/month (small database)
- Redis: ~$15–50/month (moderate caching)
- S3 (if used): minimal ($1–5/month for spice tools app)

**Total Estimated Monthly Cost:** $100–250 (excluding labor)

### 7.4 CI/CD Pipeline

```
GitHub → GitHub Actions
  ├── On PR:
  │   ├── Lint (ESLint, Prettier)
  │   ├── Type check (TypeScript)
  │   ├── Unit tests
  │   ├── Integration tests (API endpoints)
  │   └── E2E tests (critical user flows)
  └── On merge to main:
      ├── Build frontend (Next.js)
      ├── Build backend (Node.js)
      ├── Push Docker images to registry
      ├── Deploy to staging
      ├── Smoke tests
      └── Deploy to production (if passing)
```

---

## 8. MVP vs. EXTENDED ROADMAP

### MVP (Phase 1: 6–8 weeks)

**Must-Have:**
- ✅ Spice database (100–150 spices, core data populated manually + research)
- ✅ Flavor map visualization (2D, interactive, filterable)
- ✅ Basic spice detail pages
- ✅ Simple blend builder (add spices, see profile, save to local storage)
- ✅ Pairing rules explainers
- ✅ Basic auth (save blends to account)

**Data:**
- Spice flavor data: manual research + scientific sources (already available publicly)
- Aromatic compounds: simplified (top 2–3 per spice)

**Backend:**
- REST API (Express + PostgreSQL)
- Basic caching (Redis)
- No external recipe APIs yet (static content focus)

**Frontend:**
- Next.js + React
- D3 for flavor map
- Tailwind CSS

**Deployment:**
- Vercel (frontend)
- Render or AWS (backend)
- PostgreSQL managed service

### Phase 2 (Weeks 9–16)

- Ingredient network graph (fetch recipe data, compute layout, integrate API)
- Recipe analyzer tool
- Extended spice library (history, sourcing, storage)
- Public blend sharing

### Phase 3 (Weeks 17+)

- Community features (comments, ratings)
- Advanced filtering + saved searches
- Meal planning integration
- Mobile app (React Native or PWA)
- Admin dashboard for managing content

---

## 9. SUCCESS METRICS

**User Engagement:**
- Flavor map exploration time (target: 3+ min)
- Blend saves per user (target: 2+ per session)
- Return visitor rate (target: 30% in first month)

**Content Depth:**
- Spice library completeness (target: 150+ spices by MVP launch)
- Pairing rule coverage (target: 20+ explainers covering major theory)

**API Performance:**
- Flavor map load: <500ms (p95)
- Ingredient network load: <1s (p95)
- Blend analysis: <200ms (p95)

**Business:**
- Uptime: 99.5%+
- Cost per user: <$0.01/month (long-tail users)

---

## 10. OPEN QUESTIONS FOR STAKEHOLDER ALIGNMENT

1. **Recipe Data Source:** Should we build our own recipe scraper, or license data from Spoonacular/Edamam? (Cost vs. control tradeoff)
2. **Authentication:** Do we require sign-up for all features, or only for saving blends? (Frictionless vs. user tracking)
3. **Monetization:** Ad-free, freemium with premium blends, affiliate links to spice suppliers? (Revenue model)
4. **International Support:** English-only MVP, or multi-language from day one? (Scope creep)
5. **Offline Support:** Should the flavor map work offline (PWA with cached data)? (Nice-to-have)
6. **Mobile Experience:** Responsive web first, or native mobile app from launch? (Platform strategy)

---

## 11. TECHNICAL RISK MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Flavor map layout breaks with large dataset | Medium | Medium | Pre-compute 2D coords, avoid client-side layout |
| Recipe data API rate limits hit | High | Low | Cache extensively, batch requests, maybe self-host recipe scraper |
| Aromatic compound data hard to find | Medium | Medium | Start with simplified (top 3 compounds per spice), improve iteratively |
| Ingredient network graph unreadable with 500+ nodes | Medium | Medium | Use force-directed + filtering, pre-compute layout, consider Sigma.js for WebGL perf |
| User confusion on flavor map axes | Medium | Low | Add explainer tooltips, onboarding tour, context-sensitive help |
| Cold recipe API costs eat margin | Medium | Medium | Aggressively cache, consider self-hosted scraper long-term |

---

## 12. APPENDIX: SAMPLE DATA

### Example Spice Profile

```json
{
  "id": "cardamom-green",
  "name": "Green Cardamom",
  "commonNames": ["cardamom", "elaichi"],
  "botanicalName": "Elettaria cardamomum",
  "origin": "Kerala, India",
  "flavor": {
    "warmth": 65,
    "brightness": 70,
    "earthiness": 40,
    "florality": 55,
    "heat": 5,
    "confidence": 0.95
  },
  "compounds": [
    { "name": "cineol", "percentage": 35, "source": "USDA FoodData" },
    { "name": "limonene", "percentage": 12, "source": "USDA FoodData" },
    { "name": "linalool", "percentage": 8, "source": "USDA FoodData" }
  ],
  "families": ["warm spices", "citrusy", "slightly floral"],
  "cuisines": [
    { "cuisine": "Indian", "frequency": "common", "typicalQuantity": "3–4 pods per 4 servings" },
    { "cuisine": "Scandinavian", "frequency": "occasional", "typicalQuantity": "1 tsp ground per batch" },
    { "cuisine": "Middle Eastern", "frequency": "common", "typicalQuantity": "2–3 pods per 4 servings" }
  ],
  "heat": { "scoville": 0, "level": "mild" },
  "color": "#8B6914",
  "substitutes": [
    { "spiceId": "cinnamon", "similarity": 0.7, "notes": "Warmer, less citrusy" },
    { "spiceId": "clove", "similarity": 0.6, "notes": "More intense, peppery" }
  ],
  "sourcing": [
    { "supplier": "Kalustyan's", "pricePerOunce": 0.75, "url": "..." },
    { "supplier": "Penzey's", "pricePerOunce": 0.60, "url": "..." }
  ],
  "storage": {
    "shelfLife": "6–12 months (whole pods)",
    "conditions": "Cool, dark, airtight container"
  }
}
```

### Example Pairing Rule

```json
{
  "id": "garam-masala-why",
  "name": "Why Garam Masala Works",
  "description": "Garam masala combines warm spices that share overlapping aromatic compounds, creating depth without muddiness.",
  "spiceIds": ["cinnamon", "cardamom-green", "clove", "black-peppercorn", "cumin"],
  "culinaryContext": "Used across Indian cuisines as a finishing spice blend or base for curries, rice, and meat dishes.",
  "scienceExplanation": "All components share cineol and limonene compounds, creating harmonic flavor. The blend is warm (cinnamon, clove) + bright (cardamom, black pepper), balanced and complex.",
  "examples": ["Dal", "Pilau rice", "Butter chicken"],
  "riskLevel": "safe"
}
```

### Example Ingredient Network Response

```json
{
  "nodes": [
    { "id": "cumin", "label": "Cumin", "category": "spice", "size": 95, "color": "#CD853F" },
    { "id": "coriander", "label": "Coriander", "category": "spice", "size": 92, "color": "#D2B48C" },
    { "id": "onion", "label": "Onion", "category": "aromatic", "size": 99, "color": "#FFD700" },
    ...
  ],
  "edges": [
    { "source": "cumin", "target": "coriander", "strength": 0.92 },
    { "source": "cumin", "target": "onion", "strength": 0.88 },
    ...
  ],
  "layout": {
    "cumin": { "x": 150, "y": 200 },
    "coriander": { "x": 180, "y": 195 },
    ...
  },
  "metadata": {
    "totalRecipes": 47832,
    "cuisines": ["Indian", "Middle Eastern", "Mexican"],
    "generatedAt": "2025-04-14T02:00:00Z"
  }
}
```