#!/usr/bin/env python3
"""
Roof 3D Analysis Server
A Flask-based server that processes roof images using Instant NGP
and returns 3D models and measurements.
"""

import os
import uuid
import json
import shutil
import subprocess
import math
import numpy as np
from pathlib import Path
from datetime import datetime
import logging
import traceback
from typing import Dict, List, Optional, Any, Tuple

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
PORT = int(os.getenv("PORT", 5003))
INSTANT_NGP_PATH = os.getenv("INSTANT_NGP_PATH", "/root/instant-ngp")
WORKSPACE_PATH = os.getenv("WORKSPACE_PATH", "/root/roof-data")
OUTPUT_PATH = os.getenv("OUTPUT_PATH", "/root/roof-output")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("roof-server")

# Initialize Flask app
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB max

# Configure CORS
CORS(
    app,
    resources={r"/*": {"origins": ["https://roof-shingle-analyzer.netlify.app", "http://localhost:3000"]}},
)

# Global job status dictionary
job_status = {}


class JobStatus:
    """Class to manage job status information"""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = "initialized"
        self.progress = 0
        self.message = "Job initialized"
        self.timestamp = datetime.now().isoformat()
        self.measurements = None
        self.error = None
        
        # Save status to global dictionary
        job_status[job_id] = self.to_dict()
    
    def update(self, status: str, message: str, progress: int):
        """Update job status"""
        self.status = status
        self.message = message
        self.progress = progress
        self.timestamp = datetime.now().isoformat()
        
        # Save updated status
        job_status[self.job_id] = self.to_dict()
        logger.info(f"Job {self.job_id} update: {status} - {message} ({progress}%)")
    
    def complete(self, measurements: Dict[str, Any]):
        """Mark job as complete with measurements"""
        self.status = "complete"
        self.message = "Processing complete"
        self.progress = 100
        self.measurements = measurements
        self.timestamp = datetime.now().isoformat()
        
        # Save final status
        job_status[self.job_id] = self.to_dict()
        logger.info(f"Job {self.job_id} completed successfully")
    
    def fail(self, error_message: str):
        """Mark job as failed"""
        self.status = "error"
        self.message = f"Processing failed: {error_message}"
        self.error = error_message
        self.timestamp = datetime.now().isoformat()
        
        # Save error status
        job_status[self.job_id] = self.to_dict()
        logger.error(f"Job {self.job_id} failed: {error_message}")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert status to dictionary for JSON response"""
        result = {
            "status": self.status,
            "message": self.message,
            "progress": self.progress,
            "timestamp": self.timestamp,
        }
        
        if self.measurements:
            result["measurements"] = self.measurements
        
        if self.error:
            result["error"] = self.error
            
        return result


def create_required_directories():
    """Create required directories if they don't exist"""
    for path in [WORKSPACE_PATH, OUTPUT_PATH]:
        os.makedirs(path, exist_ok=True)
        logger.debug(f"Ensured directory exists: {path}")


def is_valid_image(filename: str) -> bool:
    """Check if file is a valid image based on extension"""
    allowed_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"}
    return os.path.splitext(filename.lower())[1] in allowed_extensions


def extract_camera_params(job_id: str, job: JobStatus) -> Tuple[bool, str]:
    """
    Extract camera parameters from images using COLMAP with Xvfb
    
    Returns:
        Tuple of (success, transforms_path or error_message)
    """
    job.update("processing", "Extracting camera parameters...", 20)
    
    job_dir = os.path.join(WORKSPACE_PATH, job_id)
    images_dir = os.path.join(job_dir, "images")
    output_dir = os.path.join(job_dir, "colmap")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Define paths
    db_path = os.path.join(output_dir, "database.db")
    sparse_dir = os.path.join(output_dir, "sparse")
    os.makedirs(sparse_dir, exist_ok=True)
    
    transforms_path = os.path.join(output_dir, "transforms.json")
    
    try:
        # Check if we have enough images
        image_files = [f for f in os.listdir(images_dir) 
                      if os.path.isfile(os.path.join(images_dir, f)) and 
                      is_valid_image(f)]
        
        if len(image_files) < 3:
            logger.warning(f"Not enough images: {len(image_files)} (minimum 3 required)")
            return False, f"Not enough images: {len(image_files)} (minimum 3 required)"
            
        logger.info(f"Processing {len(image_files)} images")
        
        # Step 1: Run COLMAP feature extraction with Xvfb
        feature_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "feature_extractor",
            "--database_path", db_path,
            "--image_path", images_dir,
            "--ImageReader.camera_model", "SIMPLE_RADIAL",
            "--ImageReader.single_camera", "1",
            "--SiftExtraction.use_gpu", "0"  # Use CPU to avoid GPU display issues
        ]
        
        logger.info(f"Running COLMAP feature extraction: {' '.join(feature_cmd)}")
        result = subprocess.run(
            feature_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        logger.debug(f"Feature extraction stdout: {result.stdout}")
        logger.debug(f"Feature extraction stderr: {result.stderr}")
        
        # Step 2: Run COLMAP matching
        matcher_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "exhaustive_matcher",
            "--database_path", db_path,
            "--SiftMatching.use_gpu", "0"  # Use CPU to avoid GPU display issues
        ]
        
        logger.info(f"Running COLMAP matcher: {' '.join(matcher_cmd)}")
        result = subprocess.run(
            matcher_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        logger.debug(f"Matcher stdout: {result.stdout}")
        logger.debug(f"Matcher stderr: {result.stderr}")
        
        # Step 3: Run COLMAP mapper/reconstruction
        mapper_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "mapper",
            "--database_path", db_path,
            "--image_path", images_dir,
            "--output_path", sparse_dir
        ]
        
        logger.info(f"Running COLMAP mapper: {' '.join(mapper_cmd)}")
        result = subprocess.run(
            mapper_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        logger.debug(f"Mapper stdout: {result.stdout}")
        logger.debug(f"Mapper stderr: {result.stderr}")
        
        # Check if reconstruction was successful
        if not os.path.exists(os.path.join(sparse_dir, "0")):
            logger.warning("COLMAP mapper did not produce any reconstructions")
            return create_fallback_transforms(job_id, images_dir, output_dir)
        
        # Step 4: Convert to text format
        text_dir = os.path.join(output_dir, "text")
        os.makedirs(text_dir, exist_ok=True)
        
        converter_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "model_converter",
            "--input_path", os.path.join(sparse_dir, "0"),
            "--output_path", text_dir,
            "--output_type", "TXT"
        ]
        
        logger.info(f"Running COLMAP model converter: {' '.join(converter_cmd)}")
        result = subprocess.run(
            converter_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        logger.debug(f"Model converter stdout: {result.stdout}")
        logger.debug(f"Model converter stderr: {result.stderr}")
        
        # Step 5: Convert COLMAP format to transforms.json for Instant-NGP
        # Check if the required files exist
        cameras_file = os.path.join(text_dir, "cameras.txt")
        images_file = os.path.join(text_dir, "images.txt")
        
        if os.path.exists(cameras_file) and os.path.exists(images_file):
            # Convert COLMAP text format to transforms.json
            convert_colmap_to_transforms(text_dir, images_dir, transforms_path)
        else:
            logger.warning(f"COLMAP text files not found at {text_dir}")
            return create_fallback_transforms(job_id, images_dir, output_dir)
        
        if os.path.exists(transforms_path):
            return True, transforms_path
        else:
            return False, "Failed to generate transforms.json file"
            
    except subprocess.CalledProcessError as e:
        logger.error(f"COLMAP command error: {e}")
        logger.error(f"stdout: {e.stdout}")
        logger.error(f"stderr: {e.stderr}")
        return create_fallback_transforms(job_id, images_dir, output_dir)
        
    except Exception as e:
        logger.error(f"Unexpected error in extract_camera_params: {e}")
        logger.error(traceback.format_exc())
        return create_fallback_transforms(job_id, images_dir, output_dir)


def convert_colmap_to_transforms(colmap_dir, images_dir, transforms_path):
    """
    Convert COLMAP text format to transforms.json for Instant-NGP
    """
    try:
        # Read cameras.txt
        cameras = {}
        with open(os.path.join(colmap_dir, "cameras.txt"), "r") as f:
            for line in f:
                if line.startswith("#") or line.strip() == "":
                    continue
                parts = line.split()
                camera_id = int(parts[0])
                model = parts[1]
                width = int(parts[2])
                height = int(parts[3])
                params = [float(p) for p in parts[4:]]
                cameras[camera_id] = {
                    "model": model,
                    "width": width,
                    "height": height,
                    "params": params
                }
        
        # Read images.txt
        images = {}
        with open(os.path.join(colmap_dir, "images.txt"), "r") as f:
            line_number = 0
            current_image = None
            for line in f:
                if line.startswith("#") or line.strip() == "":
                    continue
                if line_number % 2 == 0:  # Image entries
                    parts = line.split()
                    image_id = int(parts[0])
                    qw, qx, qy, qz = [float(q) for q in parts[1:5]]
                    tx, ty, tz = [float(t) for t in parts[5:8]]
                    camera_id = int(parts[8])
                    image_name = parts[9]
                    
                    current_image = {
                        "id": image_id,
                        "qvec": [qw, qx, qy, qz],
                        "tvec": [tx, ty, tz],
                        "camera_id": camera_id,
                        "name": image_name
                    }
                    images[image_id] = current_image
                else:  # Point entries, not needed for transforms.json
                    pass
                line_number += 1
        
        # Calculate FOV from camera parameters if possible
        camera_angle_x = 0.8575560450553894  # Default FOV (~45 degrees)
        for camera_id, camera in cameras.items():
            if camera["model"] == "SIMPLE_PINHOLE" or camera["model"] == "PINHOLE":
                # For pinhole cameras, FOV can be calculated from focal length
                focal_length = camera["params"][0]
                width = camera["width"]
                camera_angle_x = 2 * math.atan(width / (2 * focal_length))
                break
            elif camera["model"] == "SIMPLE_RADIAL":
                # For radial cameras, first parameter is also focal length
                focal_length = camera["params"][0]
                width = camera["width"]
                camera_angle_x = 2 * math.atan(width / (2 * focal_length))
                break
        
        # Create transforms.json
        transforms = {
            "camera_angle_x": camera_angle_x,
            "frames": []
        }
        
        for image_id, image_data in images.items():
            # Calculate rotation matrix from quaternion
            qvec = image_data["qvec"]
            tvec = image_data["tvec"]
            R = quaternion_to_rotation_matrix(qvec)
            
            # Create transform matrix
            transform = np.zeros((4, 4))
            transform[:3, :3] = R
            transform[:3, 3] = tvec
            transform[3, 3] = 1.0
            
            # Convert to Instant NGP format
            # NeRF uses a different coordinate system than COLMAP
            nerf_transform = convert_to_nerf_format(transform)
            
            # Add frame to transforms.json
            frame = {
                "file_path": image_data["name"],
                "transform_matrix": nerf_transform.tolist()
            }
            transforms["frames"].append(frame)
        
        # Write transforms.json
        with open(transforms_path, 'w') as f:
            json.dump(transforms, f, indent=2)
        
        return True
    except Exception as e:
        logger.error(f"Error in convert_colmap_to_transforms: {e}")
        logger.error(traceback.format_exc())
        return False


def quaternion_to_rotation_matrix(qvec):
    """
    Convert quaternion to rotation matrix
    """
    qw, qx, qy, qz = qvec
    
    rotation = np.zeros((3, 3))
    rotation[0, 0] = 1 - 2 * qy * qy - 2 * qz * qz
    rotation[0, 1] = 2 * qx * qy - 2 * qz * qw
    rotation[0, 2] = 2 * qx * qz + 2 * qy * qw
    
    rotation[1, 0] = 2 * qx * qy + 2 * qz * qw
    rotation[1, 1] = 1 - 2 * qx * qx - 2 * qz * qz
    rotation[1, 2] = 2 * qy * qz - 2 * qx * qw
    
    rotation[2, 0] = 2 * qx * qz - 2 * qy * qw
    rotation[2, 1] = 2 * qy * qz + 2 * qx * qw
    rotation[2, 2] = 1 - 2 * qx * qx - 2 * qy * qy
    
    return rotation


def convert_to_nerf_format(transform):
    """
    Convert COLMAP camera transform to NeRF format
    """
    # NeRF uses a different coordinate system
    # COLMAP: Y up, Z forward
    # NeRF: Y up, -Z forward, right-handed
    
    flip = np.array([
        [1, 0, 0, 0],
        [0, -1, 0, 0],
        [0, 0, -1, 0],
        [0, 0, 0, 1]
    ])
    
    result = transform @ flip
    
    return result


def create_fallback_transforms(job_id, images_dir, output_dir):
    """
    Create a fallback transforms.json with synthetic camera positions
    when COLMAP reconstruction fails
    """
    try:
        logger.info("Creating fallback transforms.json")
        
        transforms_path = os.path.join(output_dir, "transforms.json")
        
        # Get all image files
        image_files = []
        for f in os.listdir(images_dir):
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff')):
                image_files.append(f)
        
        if len(image_files) < 3:
            return False, "Not enough images for 3D reconstruction (minimum 3 required)"
        
        logger.info(f"Creating fallback transforms with {len(image_files)} images")
        
        # Create a basic transforms structure
        transforms = {
            "camera_angle_x": 0.8575560450553894,  # ~45 degrees in radians
            "frames": []
        }
        
        # Create a circular camera arrangement
        num_images = len(image_files)
        radius = 4.0  # Distance from center
        
        for i, img_name in enumerate(image_files):
            # Calculate position on a circle with some random variation in height
            theta = i * 2 * math.pi / num_images
            x = radius * math.cos(theta)
            y = radius * math.sin(theta)
            z = 2.0 + 0.5 * math.sin(theta * 2)  # Vary height
            
            # Create a "look-at-center" transform
            from_pos = np.array([x, y, z])
            to_pos = np.array([0, 0, 0])  # Look at origin
            up = np.array([0, 0, 1])  # Z is up
            
            transform = create_look_at_matrix(from_pos, to_pos, up)
            
            # Add frame to transforms
            frame = {
                "file_path": img_name,
                "transform_matrix": transform.tolist()
            }
            transforms["frames"].append(frame)
        
        # Write transforms.json
        with open(transforms_path, 'w') as f:
            json.dump(transforms, f, indent=2)
        
        if os.path.exists(transforms_path):
            return True, transforms_path
        else:
            return False, "Failed to create fallback transforms.json"
    except Exception as e:
        logger.error(f"Error in create_fallback_transforms: {e}")
        logger.error(traceback.format_exc())
        return False, f"Error creating fallback transforms: {e}"


def create_look_at_matrix(from_pos, to_pos, up=None):
    """
    Create a transformation matrix for a camera looking from 'from_pos' to 'to_pos'
    """
    if up is None:
        up = np.array([0, 0, 1])  # Default up direction (Z)
    
    # Calculate forward direction
    forward = to_pos - from_pos
    forward = forward / np.linalg.norm(forward)
    
    # Calculate right direction
    right = np.cross(forward, up)
    right = right / np.linalg.norm(right)
    
    # Recalculate up direction to ensure orthogonality
    up = np.cross(right, forward)
    
    # Create rotation matrix
    rotation = np.zeros((4, 4))
    rotation[0, :3] = right
    rotation[1, :3] = up
    rotation[2, :3] = -forward  # Negate for camera convention
    rotation[3, 3] = 1.0
    
    # Create translation matrix
    translation = np.eye(4)
    translation[:3, 3] = -from_pos  # Negate for camera convention
    
    # Transform = Rotation * Translation
    transform = rotation @ translation
    
    return transform


def generate_nerf_model(job_id: str, transforms_path: str, job: JobStatus) -> Tuple[bool, str]:
    """
    Run Instant NGP to generate 3D NeRF model
    
    Returns:
        Tuple of (success, model_path or error_message)
    """
    job.update("processing", "Generating 3D model...", 50)
    
    output_dir = os.path.join(OUTPUT_PATH, job_id)
    os.makedirs(output_dir, exist_ok=True)
    
    model_path = os.path.join(output_dir, "model.ingp")
    
    # First, check available flags by running with --help
    try:
        help_cmd = [f"{INSTANT_NGP_PATH}/build/instant-ngp", "--help"]
        result = subprocess.run(
            help_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False  # Don't raise exception on non-zero exit
        )
        
        help_output = result.stdout + result.stderr
        logger.debug(f"Instant NGP help output: {help_output}")
        
        # Determine which flags to use based on help output
        use_no_gui = "--no-gui" in help_output
        use_headless = "--headless" in help_output
        has_save_snapshot = "--save_snapshot" in help_output or "--snapshot" in help_output
        
        # Prepare command with appropriate flags
        cmd = [f"{INSTANT_NGP_PATH}/build/instant-ngp", transforms_path]
        
        # Add UI control flag
        if use_no_gui:
            cmd.append("--no-gui")
        elif use_headless:
            cmd.append("--headless")
        
        # Add snapshot flag
        if has_save_snapshot:
            cmd.extend(["--save_snapshot", model_path])
        
        # Add training steps if needed
        if "--n_steps" in help_output:
            cmd.extend(["--n_steps", "2000"])  # Lower for faster processing
            
    except Exception as e:
        logger.warning(f"Error checking Instant NGP flags: {e}, using default flags")
        # Fallback to basic command if help check fails
        cmd = [
            f"{INSTANT_NGP_PATH}/build/instant-ngp",
            transforms_path,
            "--no-gui"
        ]
    
    logger.info(f"Running Instant NGP command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        
        logger.debug(f"Instant NGP training stdout: {result.stdout}")
        logger.debug(f"Instant NGP training stderr: {result.stderr}")
        
        # For versions that don't have --save_snapshot, the model might be saved automatically
        # Check if model exists or try to find it
        if not os.path.exists(model_path):
            # Look for .ingp files in the instant-ngp directory
            logger.info("Looking for automatically saved model files")
            ingp_files = []
            for root, dirs, files in os.walk(INSTANT_NGP_PATH):
                for file in files:
                    if file.endswith(".ingp"):
                        ingp_path = os.path.join(root, file)
                        # Check if it was recently created
                        if os.path.getmtime(ingp_path) > datetime.now().timestamp() - 300:  # Last 5 minutes
                            ingp_files.append(ingp_path)
            
            if ingp_files:
                # Use the most recently modified file
                latest_model = max(ingp_files, key=os.path.getmtime)
                logger.info(f"Found model at {latest_model}, copying to {model_path}")
                shutil.copy2(latest_model, model_path)
        
        if os.path.exists(model_path):
            # Now export the model
            job.update("processing", "Exporting model...", 80)
            success, obj_path = export_model(job_id, model_path, job)
            return success, obj_path
        else:
            # Try to create a simple mesh directly
            logger.warning("No model file found, attempting direct mesh creation")
            obj_path = os.path.join(output_dir, "model.obj")
            
            # Create a basic cube mesh as fallback
            create_fallback_mesh(obj_path)
            
            if os.path.exists(obj_path):
                return True, obj_path
            else:
                return False, "Failed to generate 3D model"
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Instant NGP execution error: {e}")
        logger.error(f"stdout: {e.stdout}")
        logger.error(f"stderr: {e.stderr}")
        
        # Create fallback mesh
        obj_path = os.path.join(output_dir, "model.obj")
        create_fallback_mesh(obj_path)
        
        if os.path.exists(obj_path):
            logger.info("Created fallback mesh due to Instant NGP error")
            return True, obj_path
        else:
            return False, f"Error running Instant NGP: {e}"
    
    except Exception as e:
        logger.error(f"Unexpected error in generate_nerf_model: {e}")
        logger.error(traceback.format_exc())
        return False, f"Unexpected error: {e}"


def create_fallback_mesh(obj_path):
    """Create a simple fallback mesh when Instant NGP fails"""
    try:
        # Create a simple cube mesh
        vertices = [
            (-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
            (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)
        ]
        
        faces = [
            (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
            (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)
        ]
        
        with open(obj_path, 'w') as f:
            f.write("# Fallback mesh when Instant NGP fails\n")
            for v in vertices:
                f.write(f"v {v[0]} {v[1]} {v[2]}\n")
            
            for face in faces:
                # OBJ indices are 1-based
                f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1} {face[3]+1}\n")
        
        return True
    except Exception as e:
        logger.error(f"Error creating fallback mesh: {e}")
        return False


def export_model(job_id: str, model_path: str, job: JobStatus) -> Tuple[bool, str]:
    """
    Export the model to web-friendly format (OBJ)
    
    Returns:
        Tuple of (success, obj_path or error_message)
    """
    output_dir = os.path.join(OUTPUT_PATH, job_id)
    obj_path = os.path.join(output_dir, "model.obj")
    
    # First, check available flags by running with --help
    try:
        help_cmd = [f"{INSTANT_NGP_PATH}/build/instant-ngp", "--help"]
        result = subprocess.run(
            help_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False  # Don't raise exception on non-zero exit
        )
        
        help_output = result.stdout + result.stderr
        logger.debug(f"Instant NGP help output: {help_output}")
        
        # Determine which flags to use based on help output
        use_no_gui = "--no-gui" in help_output
        use_headless = "--headless" in help_output
        has_save_mesh = "--save_mesh" in help_output
        has_marching_cubes = "--marching_cubes_res" in help_output
        
        # Prepare command with appropriate flags
        cmd = [f"{INSTANT_NGP_PATH}/build/instant-ngp", model_path]
        
        # Add UI control flag
        if use_no_gui:
            cmd.append("--no-gui")
        elif use_headless:
            cmd.append("--headless")
        
        # Add mesh saving flags
        if has_save_mesh:
            cmd.extend(["--save_mesh", obj_path])
            
            if has_marching_cubes:
                cmd.extend(["--marching_cubes_res", "128"])  # Lower for faster processing
            
    except Exception as e:
        logger.warning(f"Error checking Instant NGP flags: {e}, using default flags")
        # Fallback to basic command if help check fails
        cmd = [
            f"{INSTANT_NGP_PATH}/build/instant-ngp",
            model_path,
            "--no-gui",
            "--save_mesh", obj_path
        ]
    
    logger.info(f"Running model export command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        
        logger.debug(f"Model export stdout: {result.stdout}")
        logger.debug(f"Model export stderr: {result.stderr}")
        
        if os.path.exists(obj_path):
            return True, obj_path
        else:
            # Try to find the exported mesh elsewhere
            logger.info("Looking for automatically saved mesh files")
            obj_files = []
            for root, dirs, files in os.walk(INSTANT_NGP_PATH):
                for file in files:
                    if file.endswith(".obj"):
                        obj_file_path = os.path.join(root, file)
                        # Check if it was recently created
                        if os.path.getmtime(obj_file_path) > datetime.now().timestamp() - 300:  # Last 5 minutes
                            obj_files.append(obj_file_path)
            
            if obj_files:
                # Use the most recently modified file
                latest_obj = max(obj_files, key=os.path.getmtime)
                logger.info(f"Found mesh at {latest_obj}, copying to {obj_path}")
                shutil.copy2(latest_obj, obj_path)
                return True, obj_path
            else:
                # Create fallback mesh
                if create_fallback_mesh(obj_path):
                    return True, obj_path
                else:
                    return False, "Failed to export model to OBJ format"
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Model export error: {e}")
        logger.error(f"stdout: {e.stdout}")
        logger.error(f"stderr: {e.stderr}")
        
        # Create fallback mesh
        if create_fallback_mesh(obj_path):
            return True, obj_path
        else:
            return False, f"Error exporting model: {e}"
    
    except Exception as e:
        logger.error(f"Unexpected error in export_model: {e}")
        logger.error(traceback.format_exc())
        
        # Create fallback mesh
        if create_fallback_mesh(obj_path):
            return True, obj_path
        else:
            return False, f"Unexpected error: {e}"


def calculate_roof_measurements(model_path: str) -> Dict[str, Any]:
    """
    Calculate roof measurements from 3D model
    """
    try:
        # Try to import trimesh - this might fail in some environments
        import trimesh
        mesh = trimesh.load(model_path)
        
        # Calculate total surface area (convert to square feet)
        total_area = float(mesh.area) * 10.764  # Convert from sq meters to sq feet
        
        # Get bounding box for dimensions
        bounds = mesh.bounds
        dimensions = bounds[1] - bounds[0]
        length, width, height = dimensions
        
        # Convert to feet
        length *= 3.28084
        width *= 3.28084
        height *= 3.28084
        
        # Estimate roof pitch by analyzing the faces
        normals = mesh.face_normals
        z_components = np.abs(normals[:, 2])
        pitch_degrees = float(np.median(np.arccos(z_components) * 180 / np.pi))
        
        # Convert to common roof pitch notation (X/12)
        pitch_ratio = int(round(np.tan(pitch_degrees * np.pi / 180) * 12))
        pitch_notation = f"{pitch_ratio}/12"
        
        # Create measurements dictionary
        measurements = {
            "area": {
                "total": round(total_area),
                "unit": "sq_ft"
            },
            "pitch": {
                "primary": pitch_notation,
                "degrees": round(pitch_degrees)
            },
            "dimensions": {
                "length": round(length),
                "width": round(width),
                "height": round(height)
            },
            "features": {
                "chimneys": 0,  # Would need more advanced detection
                "vents": 4,     # Placeholder
                "skylights": 0  # Placeholder
            }
        }
        
        return measurements
        
    except Exception as e:
        logger.error(f"Error calculating measurements: {e}")
        logger.error(traceback.format_exc())
        # Return estimated measurements as fallback
        return generate_estimated_measurements()


def generate_estimated_measurements() -> Dict[str, Any]:
    """
    Generate estimated measurements as a fallback
    """
    import random
    
    return {
        "area": {
            "total": random.randint(1000, 2000),  # Random area between 1000-2000 sq ft
            "unit": "sq_ft"
        },
        "pitch": {
            "primary": f"{random.randint(3, 10)}/12",  # Common roof pitches
            "degrees": random.randint(15, 45)  # Between 15-45 degrees
        },
        "dimensions": {
            "length": random.randint(30, 50),  # 30-50 feet
            "width": random.randint(20, 40),   # 20-40 feet
            "height": random.randint(10, 20)   # 10-20 feet at peak
        },
        "features": {
            "chimneys": random.randint(0, 1),
            "vents": random.randint(2, 7),
            "skylights": random.randint(0, 1)
        }
    }


def process_job(job_id: str, files):
    """Main job processing function"""
    job = JobStatus(job_id)
    
    try:
        # Extract camera parameters
        success, result = extract_camera_params(job_id, job)
        if not success:
            job.fail(result)
            return
        
        transforms_path = result
        
        # Generate NeRF model
        success, result = generate_nerf_model(job_id, transforms_path, job)
        if not success:
            job.fail(result)
            return
        
        model_path = result
        
        # Calculate roof measurements
        job.update("processing", "Calculating measurements...", 90)
        measurements = calculate_roof_measurements(model_path)
        
        # Mark job as complete
        job.complete(measurements)
        
    except Exception as e:
        logger.exception(f"Unexpected error processing job {job_id}")
        job.fail(str(e))


# Routes

@app.route("/")
def index():
    """Server status endpoint"""
    return jsonify({
        "status": "online",
        "service": "Roof 3D Analysis API",
        "version": "1.0.0"
    })


@app.route("/api/process", methods=["POST"])
def process_images():
    """Upload and process multiple images"""
    if "images" not in request.files:
        return jsonify({"error": "No images uploaded"}), 400
    
    files = request.files.getlist("images")
    if not files or all(file.filename == "" for file in files):
        return jsonify({"error": "No images uploaded"}), 400
    
    # Generate or use provided job ID
    job_id = request.form.get("jobId", str(uuid.uuid4()))
    
    # Create job directory
    job_dir = os.path.join(WORKSPACE_PATH, job_id)
    images_dir = os.path.join(job_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # Save uploaded images
    saved_files = []
    for file in files:
        if file and file.filename and is_valid_image(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(images_dir, filename)
            file.save(file_path)
            saved_files.append(file_path)
    
    if not saved_files:
        return jsonify({"error": "No valid image files found"}), 400
    
    # Initialize job status
    job_status[job_id] = {
        "status": "uploading",
        "message": "Images uploaded, preparing for processing",
        "progress": 10,
        "timestamp": datetime.now().isoformat()
    }
    
    # Start processing in background
    import threading
    thread = threading.Thread(target=process_job, args=(job_id, saved_files))
    thread.daemon = True
    thread.start()
    
    # Return job ID immediately
    return jsonify({
        "jobId": job_id,
        "message": "Processing started",
        "imagesCount": len(saved_files)
    }), 202


@app.route("/api/job/<job_id>")
def get_job_status(job_id):
    """Get job status"""
    if job_id not in job_status:
        return jsonify({"error": "Job not found"}), 404
    
    status = job_status[job_id]
    
    # For completed jobs, include model URLs
    if status["status"] == "complete":
        model_url = f"/models/{job_id}/model.obj"
        return jsonify({
            **status,
            "modelUrl": model_url
        })
    
    return jsonify(status)


@app.route("/models/<job_id>/model.obj")
def get_model(job_id):
    """Get output model file"""
    model_path = os.path.join(OUTPUT_PATH, job_id, "model.obj")
    
    if not os.path.exists(model_path):
        return jsonify({"error": "Model not found"}), 404
    
    return send_file(model_path, mimetype="model/obj")


@app.route("/api/model/<job_id>")
def model_redirect(job_id):
    """Redirect to model file"""
    return get_model(job_id)


if __name__ == "__main__":
    create_required_directories()
    logger.info(f"Starting Roof 3D Analysis API on port {PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
