#!/usr/bin/env python3
# process_roof_images.py - Updated script to process roof images and extract measurements

import os
import sys
import subprocess
import argparse
import json
from pathlib import Path
import time
import shutil

# Import the measurement module
import roof_measurements

def process_roof_images(input_dir, output_name):
    """Process roof images to create a NeRF model using Nerfstudio and extract measurements."""
    print(f"Processing images from {input_dir}...")
    
    # Create output directory
    output_dir = Path("processed_models") / output_name
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Status tracking file
    status_file = output_dir / "status.json"
    update_status(status_file, "processing", "Processing images", 10)
    
    # Run Nerfstudio's data processing for COLMAP
    print("Running COLMAP for camera position estimation...")
    data_dir = Path("data") / output_name
    try:
        colmap_cmd = [
            "ns-process-data", 
            "images",
            "--data", str(input_dir),
            "--output-dir", str(data_dir)
        ]
        subprocess.run(colmap_cmd, check=True)
        update_status(status_file, "processing", "Camera positions estimated successfully", 30)
    except subprocess.CalledProcessError as e:
        update_status(status_file, "error", f"COLMAP processing failed: {str(e)}", 0)
        print(f"Error: COLMAP processing failed: {e}")
        return None
    
    # Train the NeRF model
    print("Training NeRF model...")
    try:
        train_cmd = [
            "ns-train", 
            "instant-ngp",  # Use Instant-NGP implementation
            "--data", str(data_dir),
            "--output-dir", str(output_dir),
            "--pipeline.model.background-color", "white",
            "--max-num-iterations", "5000"  # Limit iterations for faster results
        ]
        subprocess.run(train_cmd, check=True)
        update_status(status_file, "processing", "NeRF model trained successfully", 70)
    except subprocess.CalledProcessError as e:
        update_status(status_file, "error", f"NeRF training failed: {str(e)}", 30)
        print(f"Error: NeRF training failed: {e}")
        return None
    
    # Export mesh from NeRF model
    print("Exporting mesh from NeRF model...")
    try:
        latest_model_dir = get_latest_model_dir(output_dir)
        if not latest_model_dir:
            update_status(status_file, "error", "Could not find trained model directory", 70)
            print("Error: Could not find trained model directory")
            return None
            
        mesh_output_path = output_dir / "roof_mesh.obj"
        export_cmd = [
            "ns-export", 
            "mesh",
            "--load-config", str(latest_model_dir / "config.yml"),
            "--output-path", str(mesh_output_path),
            "--resolution", "128",  # Lower resolution for faster extraction
            "--normal-method", "open3d"
        ]
        subprocess.run(export_cmd, check=True)
        update_status(status_file, "processing", "Mesh exported successfully", 80)
    except subprocess.CalledProcessError as e:
        update_status(status_file, "error", f"Mesh export failed: {str(e)}", 70)
        print(f"Error: Mesh export failed: {e}")
        # Continue with measurements if possible
    
    # Extract measurements from the model
    print("Extracting roof measurements...")
    try:
        if mesh_output_path.exists():
            measurements = roof_measurements.process_roof_model(mesh_output_path)
        else:
            # Try to extract measurements from the NeRF output directory
            measurements = roof_measurements.extract_measurements_from_nerf(latest_model_dir)
        
        # Save measurements to file
        measurements_path = output_dir / "measurements.json"
        with open(measurements_path, 'w') as f:
            json.dump(measurements, f, indent=2)
            
        # Create a combined result object
        result = {
            "jobId": output_name,
            "status": "complete",
            "modelPath": str(mesh_output_path),
            "measurementsPath": str(measurements_path),
            "measurements": measurements,
            "timestamp": time.time()
        }
        
        # Save result to file
        result_path = output_dir / "result.json"
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)
            
        update_status(status_file, "complete", "Processing complete", 100)
        print(f"Model training and measurement extraction complete. Results saved to {output_dir}")
        return result
        
    except Exception as e:
        update_status(status_file, "error", f"Measurement extraction failed: {str(e)}", 80)
        print(f"Error: Measurement extraction failed: {e}")
        return None

def update_status(status_file, status, message, progress):
    """Update the status file with current processing status."""
    status_data = {
        "status": status,
        "message": message,
        "progress": progress,
        "timestamp": time.time()
    }
    with open(status_file, 'w') as f:
        json.dump(status_data, f, indent=2)

def get_latest_model_dir(output_dir):
    """Find the latest model directory in the Nerfstudio output."""
    nerfstudio_models_dir = output_dir / "nerfstudio_models"
    if not nerfstudio_models_dir.exists():
        return None
        
    # Find directories that match the timestamp pattern
    timestamp_dirs = [d for d in nerfstudio_models_dir.iterdir() if d.is_dir() and len(d.name) >= 19]
    
    # Sort by name (timestamp) in descending order
    timestamp_dirs.sort(reverse=True)
    
    return timestamp_dirs[0] if timestamp_dirs else None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process roof images to create a NeRF model")
    parser.add_argument("--input", required=True, help="Directory containing roof images")
    parser.add_argument("--name", required=True, help="Name for the output model")
    
    args = parser.parse_args()
    process_roof_images(args.input, args.name)
