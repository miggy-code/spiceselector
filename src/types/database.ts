// Supabase types (auto-generated from schema)

export interface Spice {
  id: string;
  name: string;
  botanical_name: string | null;
  botanical_family: string | null;
  common_names: string[] | null;
  origin: string | null;
  description: string | null;
  warmth: number | null;
  brightness: number | null;
  earthiness: number | null;
  florality: number | null;
  heat: number | null;
  map_x: number | null;
  map_y: number | null;
  family: "warm" | "hot-pungent" | "sweet" | "earthy" | "herbal" | "floral" | "citrus-bright" | "umami-savory";
  subfamilies: string[] | null;
  heat_level: "mild" | "medium" | "hot" | "extreme";
  intensity: number | null;
  commonality: number | null;
  color: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface Pairing {
  id: number;
  spice_a: string;
  spice_b: string;
  affinity: "classic" | "complementary" | "surprising";
  note: string | null;
  cuisines: string[] | null;
  compound_overlap: number | null;
  culinary_score: number | null;
}

export interface Substitution {
  spice_id: string;
  substitute_id: string;
  similarity: number;
  notes: string | null;
}

export interface SpiceCuisine {
  spice_id: string;
  cuisine: string;
  frequency: "common" | "occasional" | "rare";
  typical_quantity: string | null;
}

export interface Compound {
  id: string;
  chemical_name: string;
  usda_url: string | null;
}

export interface SpiceCompound {
  spice_id: string;
  compound_id: string;
  plant_part: string | null;
  low_ppm: number | null;
  high_ppm: number | null;
}

export interface Blend {
  id: string;
  name: string;
  dish_type: string | null;
  notes: string | null;
  profile_warmth: number | null;
  profile_brightness: number | null;
  profile_earthiness: number | null;
  profile_florality: number | null;
  profile_heat: number | null;
  compatibility_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface BlendSpice {
  blend_id: string;
  spice_id: string;
  ratio_by_weight: number;
}
