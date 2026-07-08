import json
import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import umap

def generate_coords():
    script_dir = os.path.dirname(__file__)
    data_path = os.path.join(script_dir, '..', 'idea', 'foodb_spice_data.json')
    out_dir = os.path.join(script_dir, '..', 'public', 'data')
    
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    out_path = os.path.join(out_dir, 'spice_3d_coordinates.json')
    
    print(f"Loading {data_path}...")
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    if not data:
        print("Data is empty!")
        return

    # Build matrix
    # rows: spices, cols: compounds (amounts)
    print("Building feature matrix...")
    matrix_data = []
    metadata = []
    
    # Identify top unique flavors globally for flavor family assignment
    flavor_counts = {}
    
    for spice_name, compounds in data.items():
        spice_vector = {}
        top_flavors_for_spice = {}
        for c in compounds:
            # Add to matrix
            spice_vector[c['name']] = c['amount']
            
            # Aggregate flavors by weight (amount)
            for f in c['flavors']:
                top_flavors_for_spice[f] = top_flavors_for_spice.get(f, 0) + c['amount']
                
        # Sort internal flavors to determine primary family color
        sorted_flavors = sorted(top_flavors_for_spice.items(), key=lambda item: item[1], reverse=True)
        primary_family = sorted_flavors[0][0] if sorted_flavors else "unknown"
        
        matrix_data.append(spice_vector)
        metadata.append({
            "name": spice_name,
            "family": primary_family,
            "top_compounds": [c['name'] for c in compounds[:3]]
        })

    df = pd.DataFrame(matrix_data)
    df.fillna(0, inplace=True)
    
    # Feature Scaling: StandardScaler is good when standardizing distribution
    print("Scaling features...")
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df.values)
    
    print("Running UMAP (n_components=3)...")
    # Low n_neighbors because our dataset is small (37 spices). UMAP likes 15 by default but 5-10 is better for very small N.
    n_neighbors = min(15, len(metadata) - 1)
    reducer = umap.UMAP(n_components=3, n_neighbors=n_neighbors, min_dist=0.1, random_state=42)
    coords = reducer.fit_transform(scaled_data)
    
    # Compile final JSON
    # Mean-center the coordinates first
    coords_centered = coords - np.mean(coords, axis=0)
    # Normalize coordinates strictly between -10 and 10 to fit nicely in 3D frontend space
    max_val = np.max(np.abs(coords_centered))
    coords_normalized = (coords_centered / max_val) * 10
    
    out_json = []
    for i in range(len(metadata)):
        out_json.append({
            "id": metadata[i]["name"].lower().replace(' ', '-'),
            "name": metadata[i]["name"],
            "family": metadata[i]["family"],
            "x": round(float(coords_normalized[i][0]), 3),
            "y": round(float(coords_normalized[i][1]), 3),
            "z": round(float(coords_normalized[i][2]), 3),
            "top_compounds": metadata[i]["top_compounds"]
        })
        
    print(f"Saving to {out_path}...")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out_json, f, indent=2)
        
    print("Done!")

if __name__ == "__main__":
    generate_coords()
