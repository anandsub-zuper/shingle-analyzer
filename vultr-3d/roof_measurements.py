#!/usr/bin/env python3
# roof_measurements.py - Script to extract measurements from 3D roof models

import os
import json
import numpy as np
import trimesh
import math
from pathlib import Path

def calculate_roof_area(mesh):
    """
    Calculate the total area of the roof surface.
    
    Args:
        mesh: Trimesh mesh object representing the roof
        
    Returns:
        float: Total roof area in square feet
    """
    # Get the facet areas and sum them
    areas = mesh.area_faces
    total_area = np.sum(areas)
    
    # Convert from model units to square feet (assuming model is in meters)
    # This conversion factor should be calibrated based on actual roof sizes
    return total_area * 10.764  # 1 square meter = 10.764 square feet

def calculate_roof_pitch(mesh):
    """
    Estimate the pitch of the roof.
    
    Args:
        mesh: Trimesh mesh object representing the roof
        
    Returns:
        dict: Dictionary with pitch information (ratios and degrees)
    """
    # Get face normals
    normals = mesh.face_normals
    
    # Find the average normal vector of upward-facing faces (likely roof planes)
    up_vector = np.array([0, 0, 1])
    
    # Calculate dot products between face normals and up vector
    dot_products = np.dot(normals, up_vector)
    
    # Filter for faces that are pointing somewhat upward (dot product > 0)
    upward_faces = dot_products > 0
    if not np.any(upward_faces):
        return {"primary": "Unknown", "degrees": 0}
    
    upward_normals = normals[upward_faces]
    
    # Calculate angles with horizontal plane
    angles = np.arccos(np.abs(np.dot(upward_normals, up_vector)))
    
    # Convert to degrees
    angles_deg = np.degrees(angles)
    
    # Get primary pitch angle (most common angle)
    from scipy import stats
    if len(angles_deg) > 0:
        # Use a histogram to find the most common pitch
        hist, bin_edges = np.histogram(angles_deg, bins=36)
        primary_angle_index = np.argmax(hist)
        primary_angle = np.mean(angles_deg[np.logical_and(
            angles_deg >= bin_edges[primary_angle_index], 
            angles_deg < bin_edges[primary_angle_index + 1]
        )])
        
        # Convert angle to roof pitch ratio (rise:run)
        # Standard format is X:12 where X is the rise in inches per 12 inches of run
        rise = math.tan(math.radians(primary_angle)) * 12
        pitch_ratio = f"{rise:.1f}:12"
        
        return {
            "primary": pitch_ratio,
            "degrees": float(f"{primary_angle:.1f}")
        }
    else:
        return {"primary": "Unknown", "degrees": 0}

def calculate_dimensions(mesh):
    """
    Calculate the overall dimensions of the roof.
    
    Args:
        mesh: Trimesh mesh object representing the roof
        
    Returns:
        dict: Dictionary with length, width, and height in feet
    """
    # Get bounding box
    bounds = mesh.bounds
    
    # Calculate dimensions
    length = float(f"{(bounds[1][0] - bounds[0][0]) * 3.28084:.2f}")  # m to ft
    width = float(f"{(bounds[1][1] - bounds[0][1]) * 3.28084:.2f}")  # m to ft
    height = float(f"{(bounds[1][2] - bounds[0][2]) * 3.28084:.2f}")  # m to ft
    
    return {
        "length": length,  # feet
        "width": width,    # feet
        "height": height   # feet
    }

def detect_features(mesh, area_threshold=10.0):
    """
    Detect roof features like chimneys, vents, etc.
    This is a simplified feature detection that looks for disconnected mesh components.
    
    Args:
        mesh: Trimesh mesh object representing the roof
        area_threshold: Minimum area (in square feet) for a feature to be detected
        
    Returns:
        dict: Dictionary with counts of detected features
    """
    # Split mesh into connected components
    components = mesh.split(only_watertight=False)
    
    # Count features based on size and geometry
    features = {
        "total_components": len(components),
        "chimneys": 0,
        "vents": 0,
        "skylights": 0,
        "other_features": 0
    }
    
    for component in components:
        # Convert component area to square feet
        area = component.area * 10.764
        
        # Skip very small components (noise)
        if area < area_threshold:
            continue
            
        # This is a simplified classification based on size and shape
        # In a real implementation, you would use more sophisticated classification
        if area > 50:  # Large feature
            features["chimneys"] += 1
        elif area > 20:  # Medium feature
            features["skylights"] += 1
        else:  # Small feature
            features["vents"] += 1
            
    return features

def process_roof_model(model_path):
    """
    Process a 3D roof model to extract measurements.
    
    Args:
        model_path: Path to the 3D model file (OBJ or similar)
        
    Returns:
        dict: Dictionary with roof measurements
    """
    try:
        # Load the mesh
        mesh = trimesh.load(model_path)
        
        # Calculate measurements
        area = calculate_roof_area(mesh)
        pitch = calculate_roof_pitch(mesh)
        dimensions = calculate_dimensions(mesh)
        features = detect_features(mesh)
        
        # Create measurements object
        measurements = {
            "area": {
                "total": float(f"{area:.2f}"),
                "unit": "sq_ft"
            },
            "pitch": pitch,
            "dimensions": dimensions,
            "features": features,
            "model_info": {
                "vertices": len(mesh.vertices),
                "faces": len(mesh.faces),
                "source_path": str(model_path)
            }
        }
        
        return measurements
    
    except Exception as e:
        print(f"Error processing model: {e}")
        # Return default measurements if processing fails
        return {
            "area": {"total": 0, "unit": "sq_ft"},
            "pitch": {"primary": "Unknown", "degrees": 0},
            "dimensions": {"length": 0, "width": 0, "height": 0},
            "features": {
                "total_components": 0,
                "chimneys": 0,
                "vents": 0,
                "skylights": 0,
                "other_features": 0
            },
            "error": str(e)
        }

def extract_measurements_from_nerf(nerf_output_dir):
    """
    Extract measurements from a NeRF model output directory.
    
    Args:
        nerf_output_dir: Path to the NeRF output directory
        
    Returns:
        dict: Dictionary with roof measurements
    """
    # Look for exported mesh files (OBJ, PLY, etc.)
    mesh_path = None
    for ext in ['.obj', '.ply', '.stl', '.glb']:
        mesh_files = list(Path(nerf_output_dir).glob(f'**/*{ext}'))
        if mesh_files:
            mesh_path = mesh_files[0]
            break
    
    if mesh_path is None:
        # If no mesh file found, try to export one from the NeRF model
        try:
            # This would be implementation-specific for Nerfstudio
            # For now, we'll just return default measurements
            print("No mesh file found. Measurements unavailable.")
            return {
                "area": {"total": 0, "unit": "sq_ft"},
                "pitch": {"primary": "Unknown", "degrees": 0},
                "dimensions": {"length": 0, "width": 0, "height": 0},
                "features": {
                    "total_components": 0,
                    "chimneys": 0,
                    "vents": 0,
                    "skylights": 0,
                    "other_features": 0
                },
                "error": "No mesh file found for measurement extraction"
            }
        except Exception as e:
            print(f"Error exporting mesh from NeRF: {e}")
            return {
                "error": f"Failed to export mesh from NeRF: {e}"
            }
    
    # Process the mesh to extract measurements
    return process_roof_model(mesh_path)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Extract measurements from a 3D roof model")
    parser.add_argument("--model", required=True, help="Path to the 3D model file")
    parser.add_argument("--output", help="Path to output JSON file")
    
    args = parser.parse_args()
    
    measurements = process_roof_model(args.model)
    
    # Print measurements
    print(json.dumps(measurements, indent=2))
    
    # Save measurements if output path is provided
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(measurements, f, indent=2)
        print(f"Measurements saved to {args.output}")
