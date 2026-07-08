export interface FlavorNode {
  id: string;
  name: string;
  level: "root" | "family" | "subcategory" | "spice";
  color?: string;
  description?: string;
  children?: FlavorNode[];
}

export interface FlavorWheel {
  id: "root";
  name: "Flavor Wheel";
  level: "root";
  children: FlavorNode[];
}
