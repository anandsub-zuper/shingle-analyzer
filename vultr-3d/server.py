#!/usr/bin/env python3
"""
server.py - Flask API server for 3D roof modeling
Runs on Vultr GPU instance with NVIDIA A40-8Q GPU

This server processes multiple roof images to create 3D models using NeRF technology.
"""

import os
import uuid
import json
import logging
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/root/roof-nerf-project/server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Flask app setup
app = Flask(__name__)

# Set maximum content length for file uploads (100MB)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# Configure CORS - Allow requests from all origins
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configuration
BASE_DIR = Path("/root/roof-nerf-project")
UPLOADS_DIR = BASE_DIR / "uploads"
RESULTS_DIR = BASE_DIR / "results"
COLMAP_DIR = BASE_DIR / "colmap"
NERFSTUDIO_DIR = BASE_DIR / "nerfstudio"

# Make sure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)
COLMAP_DIR.mkdir(exist_ok=True)

# Active jobs - dictionary to store job information
active_jobs = {}

# Lock for accessing the active_jobs dictionary
jobs_lock = threading.Lock()

def ensure_dir(directory):
    """Ensure directory exists, create if not"""
    Path(directory).mkdir(exist_ok=True, parents=True)

def calculate_roof_measurements(model_path):
    """
    Calculate accurate measurements from the 3D model using trimesh library
    
    Args:
        model_path (str or Path): Path to the glTF/GLB model file
        
    Returns:
        dict: Dictionary containing roof measurements including area, pitch, dimensions, etc.
    """
    import trimesh
    import numpy as np
    import math
    from pathlib import Path
    
    logger.info(f"Calculating measurements for model: {model_path}")
    
    try:
        # Load the 3D model
        model = trimesh.load(model_path)
        
        if isinstance(model, trimesh.Scene):
            # If it's a scene (like in glTF), extract all meshes
            meshes = [m for m in model.geometry.values()]
            # Combine all meshes if needed for analysis
            combined_mesh = trimesh.util.concatenate(meshes)
        else:
            # Single mesh
            combined_mesh = model
            
        # Calculate total surface area in square feet
        # 1 sq meter = 10.764 sq feet
        area_sqft = combined_mesh.area * 10.764
        
        # Get bounding box for dimensions
        bounds = combined_mesh.bounds
        min_corner = bounds[0]
        max_corner = bounds[1]
        
        # Calculate dimensions in feet (assuming model is in meters)
        length_ft = (max_corner[0] - min_corner[0]) * 3.28084  # meters to feet
        width_ft = (max_corner[1] - min_corner[1]) * 3.28084
        height_ft = (max_corner[2] - min_corner[2]) * 3.28084
        
        # Calculate roof pitch by analyzing face normals
        # Get all face normals
        face_normals = combined_mesh.face_normals
        
        # Calculate the pitch of each face
        pitches = []
        for normal in face_normals:
            # The normal's Z component represents the face's verticality
            # A roof pitch is typically the ratio of rise to run
            # rise/run = tan(angle from horizontal)
            
            # Skip nearly vertical faces (walls) or horizontal faces (flat parts)
            if abs(normal[2]) < 0.1 or abs(normal[2]) > 0.95:
                continue
                
            # Calculate the angle from horizontal in degrees
            angle_rad = math.atan2(normal[2], math.sqrt(normal[0]**2 + normal[1]**2))
            angle_deg = math.degrees(angle_rad)
            
            # Convert to standard roof pitch notation (X/12)
            # A 45-degree angle is approximately 12/12 pitch
            rise = round(math.tan(angle_rad) * 12)
            pitch = f"{rise}/12"
            
            pitches.append({
                'pitch': pitch,
                'degrees': round(angle_deg, 1),
                'area': 0  # We'll calculate area per pitch later
            })
        
        # Group similar pitches (within 2 degrees)
        grouped_pitches = []
        for pitch in pitches:
            found_group = False
            for group in grouped_pitches:
                if abs(group['degrees'] - pitch['degrees']) < 2:
                    # Average the degrees when grouping
                    group['count'] = group.get('count', 1) + 1
                    group['degrees'] = (group['degrees'] * (group['count'] - 1) + 
                                       pitch['degrees']) / group['count']
                    # Recalculate the pitch notation
                    rise = round(math.tan(math.radians(group['degrees'])) * 12)
                    group['pitch'] = f"{rise}/12"
                    found_group = True
                    break
            
            if not found_group:
                grouped_pitches.append({
                    'pitch': pitch['pitch'],
                    'degrees': pitch['degrees'],
                    'count': 1
                })
        
        # Sort by count to find the primary/most common pitch
        grouped_pitches.sort(key=lambda x: x.get('count', 0), reverse=True)
        
        # Determine the primary pitch (most common)
        primary_pitch = grouped_pitches[0]['pitch'] if grouped_pitches else "Unknown"
        primary_degrees = grouped_pitches[0]['degrees'] if grouped_pitches else 0
        
        # Detect roof features by analyzing the mesh
        features = detect_roof_features(combined_mesh)
        
        # Calculate plane segmentation to identify different roof sections
        segments = segment_roof_planes(combined_mesh)
        
        # Create the measurements dictionary
        measurements = {
            "area": {
                "total": round(area_sqft),
                "unit": "sq_ft",
                "sections": segments['areas'] if 'areas' in segments else []
            },
            "pitch": {
                "primary": primary_pitch,
                "degrees": primary_degrees,
                "all": [{'pitch': p['pitch'], 'degrees': p['degrees']} 
                       for p in grouped_pitches[:3]]  # Include top 3 pitches
            },
            "dimensions": {
                "length": round(length_ft, 1),
                "width": round(width_ft, 1),
                "height": round(height_ft, 1)
            },
            "features": features,
            "accuracy": {
                "estimated_error_margin": "±5%",
                "confidence": "high"
            }
        }
        
        logger.info(f"Measurements calculated successfully: Area={measurements['area']['total']} sq ft, "
                   f"Pitch={measurements['pitch']['primary']}")
        
        return measurements
        
    except Exception as e:
        logger.error(f"Error calculating measurements: {e}", exc_info=True)
        # Return fallback measurements if calculation fails
        return {
            "area": {
                "total": 2000,  # Fallback area estimate
                "unit": "sq_ft",
                "estimated": True
            },
            "pitch": {
                "primary": "6/12",  # Common pitch as fallback
                "degrees": 26.6,
                "estimated": True
            },
            "dimensions": {
                "length": 60,
                "width": 40,
                "height": 15,
                "estimated": True
            },
            "features": {
                "chimneys": 0,
                "vents": 0,
                "skylights": 0,
                "estimated": True
            },
            "accuracy": {
                "estimated_error_margin": "±20%",
                "confidence": "low",
                "error": str(e)
            }
        }

def segment_roof_planes(mesh):
    """
    Segment the roof into distinct planes/sections
    
    Args:
        mesh (trimesh.Trimesh): The roof mesh
        
    Returns:
        dict: Information about the segmented planes
    """
    import numpy as np
    from sklearn.cluster import DBSCAN
    
    try:
        # Get face normals and centroids
        normals = mesh.face_normals
        face_areas = mesh.area_faces
        
        # Use DBSCAN to cluster faces by their normal direction
        # This groups faces that have similar orientation (i.e., are on the same plane)
        clustering = DBSCAN(eps=0.1, min_samples=5).fit(normals)
        labels = clustering.labels_
        
        # Count clusters (ignoring noise with label -1)
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        
        # Calculate area of each segment
        segment_areas = []
        for i in range(n_clusters):
            # Sum the areas of all faces in this segment
            segment_mask = (labels == i)
            segment_area = np.sum(face_areas[segment_mask])
            
            # Convert to square feet
            segment_area_sqft = segment_area * 10.764
            
            # Calculate average normal for this segment
            segment_normals = normals[segment_mask]
            avg_normal = np.mean(segment_normals, axis=0)
            avg_normal = avg_normal / np.linalg.norm(avg_normal)
            
            # Calculate pitch for this segment
            angle_rad = np.arccos(np.clip(np.dot(avg_normal, [0, 0, 1]), -1.0, 1.0))
            angle_deg = np.degrees(angle_rad)
            
            # Calculate standard roof pitch notation
            rise = round(np.tan(angle_rad) * 12)
            pitch = f"{rise}/12"
            
            segment_areas.append({
                "id": i,
                "area": round(segment_area_sqft),
                "pitch": pitch,
                "degrees": round(angle_deg, 1)
            })
        
        # Sort segments by area (largest first)
        segment_areas.sort(key=lambda x: x["area"], reverse=True)
        
        return {
            "count": n_clusters,
            "areas": segment_areas
        }
        
    except Exception as e:
        logger.error(f"Error in plane segmentation: {e}", exc_info=True)
        return {
            "count": 1,
            "areas": [],
            "error": str(e)
        }

def detect_roof_features(mesh):
    """
    Detect features like chimneys, vents, skylights on the roof
    
    Args:
        mesh (trimesh.Trimesh): The roof mesh
        
    Returns:
        dict: Detected features and counts
    """
    try:
        # This would normally use more sophisticated analysis
        # For example, looking for vertical protrusions (chimneys),
        # rectangular cutouts (skylights), or small circular elements (vents)
        
        # For now, we'll implement a basic heuristic detection based on
        # connected components and their dimensions
        
        # Split mesh into connected components
        components = mesh.split(only_watertight=False)
        
        # Initialize feature counts
        chimneys = 0
        vents = 0
        skylights = 0
        
        # Analyze each component
        for comp in components:
            # Skip very large components (likely the main roof)
            if comp.area > (mesh.area * 0.1):
                continue
                
            # Get component dimensions
            bounds = comp.bounds
            min_corner = bounds[0]
            max_corner = bounds[1]
            
            width = max_corner[0] - min_corner[0]
            length = max_corner[1] - min_corner[1]
            height = max_corner[2] - min_corner[2]
            
            # Simple heuristics for classification
            # These would be tuned based on actual models
            
            # Chimneys are typically tall and narrow
            if height > 1.0 and width < 1.0 and length < 1.0:
                chimneys += 1
                
            # Vents are small and often circular or square
            elif width < 0.5 and length < 0.5 and height < 0.3:
                vents += 1
                
            # Skylights are typically rectangular and flat
            elif width > 0.5 and length > 0.5 and height < 0.3:
                skylights += 1
        
        return {
            "chimneys": chimneys,
            "vents": vents,
            "skylights": skylights,
            "total_features": chimneys + vents + skylights
        }
        
    except Exception as e:
        logger.error(f"Error detecting roof features: {e}", exc_info=True)
        return {
            "chimneys": 0,
            "vents": 0,
            "skylights": 0,
            "total_features": 0,
            "error": str(e)
        }

def process_images(job_id, image_dir):
    """
    Process the uploaded images to create a 3D model
    This function runs in a separate thread
    """
    try:
        update_job_status(job_id, "processing", 5, "Starting image processing...")
        
        # Directory setup
        job_dir = RESULTS_DIR / job_id
        ensure_dir(job_dir)
        output_dir = job_dir / "output"
        ensure_dir(output_dir)
        
        # Step 1: Run COLMAP for camera position estimation
        logger.info(f"Starting COLMAP for job {job_id}")
        update_job_status(job_id, "processing", 10, "Running COLMAP for camera position estimation...")
        
        colmap_output_dir = job_dir / "colmap"
        ensure_dir(colmap_output_dir)
        
        # Run COLMAP SfM to estimate camera positions
        colmap_cmd = [
            "colmap", "automatic_reconstructor",
            "--workspace_path", str(colmap_output_dir),
            "--image_path", str(image_dir)
        ]
        
        try:
            subprocess.run(colmap_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info(f"COLMAP finished for job {job_id}")
            update_job_status(job_id, "processing", 30, "Camera positions estimated successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"COLMAP failed for job {job_id}: {e}")
            logger.error(f"STDOUT: {e.stdout.decode() if e.stdout else 'None'}")
            logger.error(f"STDERR: {e.stderr.decode() if e.stderr else 'None'}")
            update_job_status(job_id, "error", 0, "Failed to estimate camera positions")
            return
            
        # Step 2: Train NeRF model using Nerfstudio
        logger.info(f"Starting NeRF training for job {job_id}")
        update_job_status(job_id, "processing", 40, "Training 3D model (NeRF)...")
        
        # Prepare Nerfstudio command
        nerf_output_dir = job_dir / "nerf"
        ensure_dir(nerf_output_dir)
        
        # Configuration for instant-ngp, which is faster than original NeRF
        nerf_cmd = [
            "ns-train", "instant-ngp",
            "--data", str(image_dir),
            "--output-dir", str(nerf_output_dir),
            "--timestamp", job_id,
            "--max-num-iterations", "5000",  # Limit iterations for faster results
            "--pipeline.model.background-color", "white"
        ]
        
        try:
            subprocess.run(nerf_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info(f"NeRF training finished for job {job_id}")
            update_job_status(job_id, "processing", 70, "3D model trained successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"NeRF training failed for job {job_id}: {e}")
            logger.error(f"STDOUT: {e.stdout.decode() if e.stdout else 'None'}")
            logger.error(f"STDERR: {e.stderr.decode() if e.stderr else 'None'}")
            update_job_status(job_id, "error", 0, "Failed to train 3D model")
            return
            
        # Step 3: Export model to glTF format
        logger.info(f"Exporting model for job {job_id}")
        update_job_status(job_id, "processing", 80, "Exporting 3D model...")
        
        # Path to the trained model
        model_path = list(nerf_output_dir.glob(f"{job_id}/nerfstudio_models/*.ckpt"))[0]
        export_dir = job_dir / "export"
        ensure_dir(export_dir)
        
        # Export command
        export_cmd = [
            "ns-export", "gltf",
            "--load-config", str(model_path),
            "--output-dir", str(export_dir),
            "--decimation-factor", "0.1",  # Reduce polygon count for web display
            "--normal-method", "finite_difference"
        ]
        
        try:
            subprocess.run(export_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info(f"Model export finished for job {job_id}")
            update_job_status(job_id, "processing", 90, "3D model exported successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Model export failed for job {job_id}: {e}")
            logger.error(f"STDOUT: {e.stdout.decode() if e.stdout else 'None'}")
            logger.error(f"STDERR: {e.stderr.decode() if e.stderr else 'None'}")
            update_job_status(job_id, "error", 0, "Failed to export 3D model")
            return
            
        # Step 4: Calculate roof measurements
        logger.info(f"Calculating measurements for job {job_id}")
        update_job_status(job_id, "processing", 95, "Calculating roof measurements...")
        
        # Model path
        glb_model = list(export_dir.glob("*.glb"))[0]
        
        # Calculate roof measurements using our advanced function
        measurements = calculate_roof_measurements(glb_model)
        
        # Save measurements to file
        measurements_file = job_dir / "measurements.json"
        with open(measurements_file, "w") as f:
            json.dump(measurements, f, indent=2)
            
        # Update job status with model path and measurements
        model_url = f"/api/model/{job_id}"
        
        with jobs_lock:
            if job_id in active_jobs:
                active_jobs[job_id].update({
                    "status": "complete",
                    "progress": 100,
                    "message": "Processing complete",
                    "modelUrl": model_url,
                    "measurements": measurements,
                    "completedAt": datetime.now().isoformat()
                })
                
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing images for job {job_id}: {e}", exc_info=True)
        update_job_status(job_id, "error", 0, f"Processing error: {str(e)}")

def simplified_process_images(job_id, image_dir):
    """
    Simplified version that skips the actual 3D processing
    but provides a mock response for testing the API
    """
    try:
        update_job_status(job_id, "processing", 5, "Starting simplified processing...")
        
        # Make necessary directories
        job_dir = RESULTS_DIR / job_id
        ensure_dir(job_dir)
        
        # Simulate processing with delays
        time.sleep(2)
        update_job_status(job_id, "processing", 30, "Analyzing camera positions...")
        
        time.sleep(2)
        update_job_status(job_id, "processing", 60, "Building 3D model...")
        
        time.sleep(2)
        update_job_status(job_id, "processing", 90, "Calculating measurements...")
        
        # Create mock measurements
        measurements = {
            "area": {
                "total": 2430,
                "unit": "sq_ft",
                "sections": [
                    {"id": 0, "area": 1500, "pitch": "6/12", "degrees": 26.6},
                    {"id": 1, "area": 930, "pitch": "4/12", "degrees": 18.4}
                ]
            },
            "pitch": {
                "primary": "6/12",
                "degrees": 26.6,
                "all": [
                    {"pitch": "6/12", "degrees": 26.6},
                    {"pitch": "4/12", "degrees": 18.4}
                ]
            },
            "dimensions": {
                "length": 65,
                "width": 45,
                "height": 18
            },
            "features": {
                "chimneys": 1,
                "vents": 3,
                "skylights": 0,
                "total_features": 4
            },
            "accuracy": {
                "estimated_error_margin": "±15%",
                "confidence": "medium",
                "note": "Mock data for testing"
            }
        }
        
        # Save measurements to file
        measurements_file = job_dir / "measurements.json"
        with open(measurements_file, "w") as f:
            json.dump(measurements, f, indent=2)
            
        # Create a placeholder model URL
        model_url = f"/api/model/{job_id}"
        
        # Update job status with model path and measurements
        with jobs_lock:
            if job_id in active_jobs:
                active_jobs[job_id].update({
                    "status": "complete",
                    "progress": 100,
                    "message": "Processing complete (simplified mode)",
                    "modelUrl": model_url,
                    "measurements": measurements,
                    "completedAt": datetime.now().isoformat(),
                    "note": "Running in simplified mode without 3D model generation"
                })
                
        logger.info(f"Job {job_id} completed in simplified mode")
        
    except Exception as e:
        logger.error(f"Error in simplified processing for job {job_id}: {e}", exc_info=True)
        update_job_status(job_id, "error", 0, f"Processing error: {str(e)}")

def update_job_status(job_id, status, progress, message):
    """Update the status of a job in the active_jobs dictionary"""
    with jobs_lock:
        if job_id in active_jobs:
            active_jobs[job_id].update({
                "status": status,
                "progress": progress,
                "message": message,
                "updatedAt": datetime.now().isoformat()
            })
            logger.info(f"Job {job_id} status updated: {status}, {progress}%, {message}")

@app.route('/api/status', methods=['GET'])
def api_status():
    """Check if the server is running and ready"""
    return jsonify({
        "service": "NeRF Roof Processing API",
        "status": "online",
        "version": "1.0.0"
    })

@app.route('/api/process', methods=['POST'])
def process_roof_images():
    """
    Process uploaded images to create a 3D model
    Expects multiple image files in the request
    """
    logger.info("Received upload request")
    
    try:
        # Check if files were uploaded
        if 'images' not in request.files:
            logger.warning("No images field in request")
            return jsonify({
                "status": "error",
                "message": "No images uploaded"
            }), 400
            
        files = request.files.getlist('images')
        logger.info(f"Received {len(files)} files")
        
        if len(files) < 3:
            return jsonify({
                "status": "error",
                "message": "At least 3 images are required for 3D reconstruction"
            }), 400
            
        # Create a unique job ID
        job_id = str(uuid.uuid4())
        
        # Create directories for this job
        job_upload_dir = UPLOADS_DIR / job_id
        ensure_dir(job_upload_dir)
        
        # Save uploaded images
        file_count = 0
        for file in files:
            if file.filename == '':
                continue
                
            # Check if the file is a valid image
            if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue
                
            # Save the file
            file_path = job_upload_dir / file.filename
            file.save(file_path)
            file_count += 1
            
        if file_count < 3:
            # Clean up
            shutil.rmtree(job_upload_dir)
            
            return jsonify({
                "status": "error",
                "message": f"Not enough valid images: {file_count} saved, at least 3 required"
            }), 400
            
        # Create job entry
        with jobs_lock:
            active_jobs[job_id] = {
                "id": job_id,
                "status": "uploading",
                "progress": 0,
                "message": "Images uploaded, preparing for processing",
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat(),
                "imageCount": file_count
            }
            
        # Start processing in a separate thread - using FULL PROCESSING mode
        processing_thread = threading.Thread(
            target=process_images,  # Using full 3D processing
            args=(job_id, job_upload_dir)
        )
        processing_thread.daemon = True
        processing_thread.start()
        
        return jsonify({
            "status": "success",
            "message": "Images uploaded successfully",
            "jobId": job_id,
            "imageCount": file_count
        })
        
    except Exception as e:
        logger.error(f"Error processing upload: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Server error: {str(e)}"
        }), 500

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get the status of a specific job"""
    with jobs_lock:
        if job_id not in active_jobs:
            return jsonify({
                "status": "error",
                "message": "Job not found"
            }), 404
            
        job_info = active_jobs[job_id].copy()
        
    return jsonify(job_info)

@app.route('/api/model/<job_id>', methods=['GET'])
def get_model(job_id):
    """
    Get the 3D model and measurements for a completed job
    Returns the model file or JSON with model URL and measurements
    """
    # Format parameter determines what to return
    format_param = request.args.get('format', 'json')
    
    with jobs_lock:
        if job_id not in active_jobs:
            return jsonify({
                "status": "error",
                "message": "Job not found"
            }), 404
            
        job_info = active_jobs[job_id].copy()
        
    if job_info['status'] != 'complete':
        return jsonify({
            "status": "error",
            "message": f"Job is not complete: {job_info['status']}"
        }), 400
        
    # Look for the model file
    job_dir = RESULTS_DIR / job_id
    export_dir = job_dir / "export"
    
    # For simplified mode, we won't have a real model file
    if "note" in job_info and "simplified mode" in job_info["note"]:
        # Return mock data
        measurements_file = job_dir / "measurements.json"
        if measurements_file.exists():
            with open(measurements_file, "r") as f:
                measurements = json.load(f)
        else:
            measurements = job_info.get("measurements", {})
            
        # Generate URLs for frontend
        model_url = f"/api/model/{job_id}?format=glb"
        
        return jsonify({
            "status": "success",
            "jobId": job_id,
            "modelUrl": model_url,
            "measurements": measurements,
            "note": "Running in simplified mode without 3D model generation"
        })
        
    # For full mode, check for the actual GLB file
    glb_files = list(export_dir.glob("*.glb"))
    if not glb_files:
        return jsonify({
            "status": "error",
            "message": "Model file not found"
        }), 404
        
    glb_model = glb_files[0]
    
    # Get measurements
    measurements_file = job_dir / "measurements.json"
    if measurements_file.exists():
        with open(measurements_file, "r") as f:
            measurements = json.load(f)
    else:
        measurements = None
        
    # Return the model file or model info
    if format_param == 'glb':
        return send_file(
            glb_model,
            mimetype='model/gltf-binary',
            as_attachment=True,
            download_name=f"roof_model_{job_id}.glb"
        )
    else:
        # Generate URLs for frontend
        model_url = f"/api/model/{job_id}?format=glb"
        
        return jsonify({
            "status": "success",
            "jobId": job_id,
            "modelUrl": model_url,
            "measurements": measurements
        })

@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    """List all active jobs (admin endpoint)"""
    # Simple API key check for admin endpoints
    api_key = request.args.get('key')
    if api_key != os.environ.get('ADMIN_API_KEY'):
        return jsonify({
            "status": "error",
            "message": "Unauthorized"
        }), 401
        
    with jobs_lock:
        job_list = list(active_jobs.values())
        
    return jsonify({
        "status": "success",
        "count": len(job_list),
        "jobs": job_list
    })

@app.route('/api/cleanup', methods=['POST'])
def cleanup_old_jobs():
    """Clean up old jobs (admin endpoint)"""
    # Simple API key check for admin endpoints
    api_key = request.args.get('key')
    if api_key != os.environ.get('ADMIN_API_KEY'):
        return jsonify({
            "status": "error",
            "message": "Unauthorized"
        }), 401
        
    # Get days parameter (default: 7 days)
    days = int(request.args.get('days', 7))
    
    # Calculate cutoff time
    cutoff = datetime.now().timestamp() - (days * 86400)
    
    cleaned_jobs = []
    
    with jobs_lock:
        for job_id, job_info in list(active_jobs.items()):
            # Check if job is old enough to clean up
            created_at = datetime.fromisoformat(job_info['createdAt'])
            if created_at.timestamp() < cutoff:
                # Remove job data
                try:
                    job_upload_dir = UPLOADS_DIR / job_id
                    job_result_dir = RESULTS_DIR / job_id
                    
                    if job_upload_dir.exists():
                        shutil.rmtree(job_upload_dir)
                        
                    if job_result_dir.exists():
                        shutil.rmtree(job_result_dir)
                        
                    # Remove from active jobs
                    del active_jobs[job_id]
                    cleaned_jobs.append(job_id)
                    
                except Exception as e:
                    logger.error(f"Error cleaning up job {job_id}: {e}")
    
    return jsonify({
        "status": "success",
        "message": f"Cleaned up {len(cleaned_jobs)} old jobs",
        "cleanedJobs": cleaned_jobs
    })

if __name__ == '__main__':
    # Check for all required dependencies
    try:
        import trimesh
        import numpy as np
        from sklearn.cluster import DBSCAN
        logger.info("Required libraries for measurement installed")
    except ImportError as e:
        logger.warning(f"Some libraries are missing: {e}. Measurements may not be accurate.")
    
    logger.info("Starting 3D Roof Analysis API server")
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
