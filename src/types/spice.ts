export interface FlavorNode {
  id: string;
  name: string;
  level: "root" | "family" | "subcategory" | "spice";
  color?: string;
  description?: string;
  children?: FlavorNode[];
}

export type PairingAffinity = "classic" | "complementary" | "surprising";

export interface KeyCompound {
  name: string;
  role: string;
}

export interface ProfilePairing {
  spice: string;
  affinity: PairingAffinity;
  note: string;
  cuisines?: string[];
}

export interface ProfileCuisine {
  cuisine: string;
  frequency: string;
  typical_quantity?: string;
}

export interface ProfileSubstitute {
  spice: string;
  similarity: number | null;
  notes: string | null;
}

/**
 * One entry of ingestion/generated_profiles.json (Gemini-generated, curated).
 * Fields are optional because the page tolerates partially generated profiles.
 */
export interface GeneratedProfile {
  id: string;
  name: string;
  family: string;
  description?: string;
  warmth?: number;
  brightness?: number;
  earthiness?: number;
  florality?: number;
  heat?: number;
  intensity?: number;
  commonality?: number;
  origin?: string;
  heat_level?: string;
  key_compounds?: KeyCompound[];
  top_pairings?: ProfilePairing[];
  cuisines?: ProfileCuisine[];
  subfamilies?: string[];
  substitutes?: (Partial<ProfileSubstitute> & { spice: string })[];
}

/** The normalized spice record the page hands to the client views. */
export interface SpiceProfile {
  id: string;
  name: string;
  family: string;
  description: string | null;
  warmth: number;
  brightness: number;
  earthiness: number;
  florality: number;
  heat: number;
  intensity: number;
  commonality: number;
  origin: string | null;
  heat_level: string | null;
  key_compounds: KeyCompound[];
  top_pairings: ProfilePairing[];
  cuisines: ProfileCuisine[];
  cuisine_names: string[];
  subfamilies: string[];
  substitutes: ProfileSubstitute[];
}
