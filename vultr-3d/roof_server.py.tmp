#!/usr/bin/env python3
"""
Enhanced Roof 3D Analysis Server
A Flask-based server that processes roof images using advanced photogrammetry
and Neural Radiance Fields to produce accurate 3D models and measurements.
"""

import os
import uuid
import json
import shutil
import subprocess
import math
import numpy as np
import cv2
from pathlib import Path
from datetime import datetime
import logging
import traceback
import time
import asyncio
import concurrent.futures
from typing import Dict, List, Optional, Any, Tuple, Union

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import celery
from celery import Celery

# Optional imports - try to load specialized libraries but continue if not available
try:
    import trimesh
except ImportError:
    trimesh = None

try:
    import open3d as o3d
except ImportError:
    o3d = None

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Load environment variables
load_dotenv()

# Configuration
PORT = int(os.getenv("PORT", 5003))
INSTANT_NGP_PATH = os.getenv("INSTANT_NGP_PATH", "/root/instant-ngp")
WORKSPACE_PATH = os.getenv("WORKSPACE_PATH", "/root/roof-data")
OUTPUT_PATH = os.getenv("OUTPUT_PATH", "/root/roof-output")
CACHE_PATH = os.getenv("CACHE_PATH", "/root/roof-cache")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
USE_GPU = os.getenv("USE_GPU", "True").lower() == "true"
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "3"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
MLM_SERVER_URL = os.getenv("MLM_SERVER_URL", "")  # URL for ML models server
API_VERSION = "v2"  # For versioned API endpoints

# Setup logging with a more detailed format
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
    handlers=[
        logging.FileHandler("roof_server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("roof-server")

# Initialize Flask app
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB max
app.config['CELERY_BROKER_URL'] = CELERY_BROKER_URL
app.config['CELERY_RESULT_BACKEND'] = CELERY_RESULT_BACKEND

# Initialize Celery
celery_app = Celery(
    app.name, 
    broker=app.config['CELERY_BROKER_URL'],
    backend=app.config['CELERY_RESULT_BACKEND']
)
celery_app.conf.update(app.config)

# Configure CORS with more specific settings
CORS(
    app,
    resources={
        f"/api/{API_VERSION}/*": {
            "origins": [
                "https://roof-shingle-analyzer.netlify.app", 
                "http://localhost:3000",
                # Add other authorized origins as needed
            ],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    },
    supports_credentials=True
)

# Create basic directories needed for operation
for path in [WORKSPACE_PATH, OUTPUT_PATH, CACHE_PATH]:
    os.makedirs(path, exist_ok=True)

# In-memory cache for job status and processing stages
job_status = {}

# Semaphore to limit concurrent processing jobs
processing_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

# Define roof types for classification
ROOF_TYPES = {
    "gable": "A roof with two sloping sides that meet at a ridge",
    "hip": "A roof with slopes on all four sides",
    "flat": "A roof with minimal or no slope",
    "mansard": "A roof with four sides having two slopes on each side",
    "gambrel": "A roof with two sides, each with two slopes",
    "shed": "A roof with only one sloping plane",
    "pyramid": "A roof with four triangular sides meeting at a point",
    "dome": "A roof with a rounded, hemispherical shape",
    "complex": "A roof with multiple roof types combined"
}

# Define common errors and fallback strategies
ERROR_TYPES = {
    "colmap_feature_extraction_failed": {
        "description": "COLMAP feature extraction failed",
        "fallback": "use_image_analysis_fallback",
        "retry_with": {"SiftExtraction.max_num_features": 16384, "SiftExtraction.peak_threshold": 0.002},
    },
    "colmap_matching_failed": {
        "description": "COLMAP feature matching failed",
        "fallback": "try_sequential_matcher",
        "retry_with": {"SiftMatching.max_ratio": 0.9, "SiftMatching.max_distance": 0.9},
    },
    "colmap_reconstruction_failed": {
        "description": "COLMAP sparse reconstruction failed",
        "fallback": "create_synthetic_camera_positions",
        "retry_with": {"Mapper.min_model_size": 3, "Mapper.init_min_num_inliers": 10},
    },
    "insufficient_overlap": {
        "description": "Insufficient overlap between images",
        "fallback": "recommend_new_images",
        "retry_with": {"reduce_image_count": True},
    },
    "nerf_training_failed": {
        "description": "NeRF training failed",
        "fallback": "use_simple_mesh_reconstruction",
        "retry_with": {"reduce_resolution": True, "max_iterations": 2000},
    },
    "mesh_extraction_failed": {
        "description": "Mesh extraction from NeRF failed",
        "fallback": "use_point_cloud_direct",
        "retry_with": {"marching_cubes_res": 64, "simplify_mesh": True},
    },
}


class JobStatus:
    """Enhanced class to manage job status information with detailed progress tracking"""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = "initialized"
        self.progress = 0
        self.message = "Job initialized"
        self.timestamp = datetime.now().isoformat()
        self.measurements = None
        self.error = None
        self.warnings = []
        self.processing_time = {
            "start": time.time(),
            "end": None,
            "stages": {}
        }
        self.stage_details = {
            "current": "initialization",
            "completed": [],
            "failed": [],
            "attempts": {}
        }
        self.resources = {
            "cpu_usage": 0,
            "memory_usage": 0,
            "gpu_usage": 0 if USE_GPU else None
        }
        self.image_metadata = {
            "count": 0,
            "quality_score": 0,
            "coverage_score": 0
        }
        self.processing_options = {
            "use_gpu": USE_GPU,
            "high_quality": False,
            "prioritize_speed": False,
            "roof_type_hint": None
        }
        
        # Cache key for storing interim results
        self.cache_key = f"job_{job_id}"
        
        # Save status to global dictionary
        job_status[job_id] = self.to_dict()
        logger.info(f"Job {job_id} initialized")
    
    def start_stage(self, stage_name: str, message: str = None):
        """Record the start of a processing stage"""
        self.stage_details["current"] = stage_name
        if stage_name not in self.stage_details["attempts"]:
            self.stage_details["attempts"][stage_name] = 0
        self.stage_details["attempts"][stage_name] += 1
        
        self.processing_time["stages"][stage_name] = {
            "start": time.time(),
            "end": None,
            "duration": None
        }
        
        if message:
            self.message = message
        else:
            self.message = f"Processing stage: {stage_name}"
            
        job_status[self.job_id] = self.to_dict()
        logger.info(f"Job {self.job_id} - Stage {stage_name} started")
    
    def end_stage(self, stage_name: str, success: bool = True):
        """Record the completion of a processing stage"""
        if stage_name in self.processing_time["stages"]:
            self.processing_time["stages"][stage_name]["end"] = time.time()
            self.processing_time["stages"][stage_name]["duration"] = (
                self.processing_time["stages"][stage_name]["end"] - 
                self.processing_time["stages"][stage_name]["start"]
            )
        
        if success:
            if stage_name not in self.stage_details["completed"]:
                self.stage_details["completed"].append(stage_name)
        else:
            if stage_name not in self.stage_details["failed"]:
                self.stage_details["failed"].append(stage_name)
        
        # Update in-memory cache
        job_status[self.job_id] = self.to_dict()
        
        duration = "unknown"
        if stage_name in self.processing_time["stages"]:
            if self.processing_time["stages"][stage_name]["duration"] is not None:
                duration = f"{self.processing_time['stages'][stage_name]['duration']:.2f}s"
        
        logger.info(f"Job {self.job_id} - Stage {stage_name} {'completed' if success else 'failed'} in {duration}")
    
    def update(self, status: str, message: str, progress: int, update_timestamp: bool = True):
        """Update job status with progress information"""
        self.status = status
        self.message = message
        self.progress = progress
        
        if update_timestamp:
            self.timestamp = datetime.now().isoformat()
        
        # Update resource usage if possible
        try:
            import psutil
            process = psutil.Process(os.getpid())
            self.resources["cpu_usage"] = process.cpu_percent()
            self.resources["memory_usage"] = process.memory_info().rss / 1024 / 1024  # MB
            
            if USE_GPU and TORCH_AVAILABLE:
                import torch
                if torch.cuda.is_available():
                    self.resources["gpu_usage"] = torch.cuda.memory_allocated() / 1024 / 1024  # MB
        except:
            pass
        
        # Save updated status
        job_status[self.job_id] = self.to_dict()
        logger.info(f"Job {self.job_id} update: {status} - {message} ({progress}%)")
    
    def add_warning(self, warning_message: str):
        """Add a warning to the job status"""
        if warning_message not in self.warnings:
            self.warnings.append(warning_message)
            # Save updated status
            job_status[self.job_id] = self.to_dict()
            logger.warning(f"Job {self.job_id} warning: {warning_message}")
    
    def complete(self, measurements: Dict[str, Any]):
        """Mark job as complete with measurements"""
        self.status = "complete"
        self.message = "Processing complete"
        self.progress = 100
        self.measurements = measurements
        self.timestamp = datetime.now().isoformat()
        self.processing_time["end"] = time.time()
        self.processing_time["total_duration"] = self.processing_time["end"] - self.processing_time["start"]
        
        # Save final status
        job_status[self.job_id] = self.to_dict()
        
        logger.info(f"Job {self.job_id} completed successfully in {self.processing_time['total_duration']:.2f}s")
        
        # Store the final result to cache for retrieval
        self._cache_results()
    
    def fail(self, error_message: str, error_type: str = None):
        """Mark job as failed with detailed error information"""
        self.status = "error"
        self.message = f"Processing failed: {error_message}"
        self.error = {
            "message": error_message,
            "type": error_type,
            "timestamp": datetime.now().isoformat(),
            "stage": self.stage_details["current"]
        }
        self.timestamp = datetime.now().isoformat()
        self.processing_time["end"] = time.time()
        self.processing_time["total_duration"] = self.processing_time["end"] - self.processing_time["start"]
        
        # Save error status
        job_status[self.job_id] = self.to_dict()
        
        if error_type in ERROR_TYPES:
            logger.error(f"Job {self.job_id} failed with known error type {error_type}: {error_message}")
        else:
            logger.error(f"Job {self.job_id} failed: {error_message}")
    
    def update_image_metadata(self, image_count: int, quality_score: float = None, coverage_score: float = None):
        """Update metadata about the images being processed"""
        self.image_metadata["count"] = image_count
        
        if quality_score is not None:
            self.image_metadata["quality_score"] = quality_score
            
        if coverage_score is not None:
            self.image_metadata["coverage_score"] = coverage_score
            
        # Save updated status
        job_status[self.job_id] = self.to_dict()
    
    def update_processing_options(self, options: Dict[str, Any]):
        """Update processing options"""
        self.processing_options.update(options)
        # Save updated status
        job_status[self.job_id] = self.to_dict()
    
    def _cache_results(self):
        """Cache the job results for faster retrieval"""
        cache_dir = os.path.join(CACHE_PATH, self.job_id)
        os.makedirs(cache_dir, exist_ok=True)
        
        # Cache the job status
        with open(os.path.join(cache_dir, "status.json"), 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
            
        # Cache measurements if available
        if self.measurements:
            with open(os.path.join(cache_dir, "measurements.json"), 'w') as f:
                json.dump(self.measurements, f, indent=2)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert status to dictionary for JSON response"""
        result = {
            "jobId": self.job_id,
            "status": self.status,
            "message": self.message,
            "progress": self.progress,
            "timestamp": self.timestamp,
            "stage": self.stage_details["current"],
            "completedStages": self.stage_details["completed"],
            "processingTime": {
                "total": self.processing_time["total_duration"] if self.processing_time["end"] else None,
                "startTime": datetime.fromtimestamp(self.processing_time["start"]).isoformat(),
                "endTime": datetime.fromtimestamp(self.processing_time["end"]).isoformat() if self.processing_time["end"] else None
            },
            "imageMetadata": self.image_metadata
        }
        
        if self.measurements:
            result["measurements"] = self.measurements
        
        if self.error:
            result["error"] = self.error
            
        if self.warnings:
            result["warnings"] = self.warnings
            
        return result


class ImageQualityAnalyzer:
    """
    Analyzes images for quality, blur detection, and coverage
    to ensure optimal photogrammetry processing
    """
    def __init__(self):
        self.min_image_size = 1024  # Minimum dimension (width or height) in pixels
        self.min_image_count = 8    # Minimum number of images required
        self.max_blur_threshold = 100  # Laplacian variance threshold for blur detection
    
    def analyze_images(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        Analyze a set of images and return quality metrics
        
        Args:
            image_paths: List of paths to image files
            
        Returns:
            Dictionary with quality analysis results
        """
        if len(image_paths) < self.min_image_count:
            return {
                "quality_score": 0,
                "coverage_score": 0,
                "sufficient_quality": False,
                "issues": [f"Insufficient image count: {len(image_paths)}. Minimum required: {self.min_image_count}"],
                "recommendations": ["Upload at least 8 images from different angles around the roof"]
            }
        
        # Placeholder for image quality results
        image_qualities = []
        issues = []
        recommendations = []
        
        # Analyze each image
        for path in image_paths:
            try:
                # Load image
                img = cv2.imread(path)
                if img is None:
                    issues.append(f"Unable to load image: {os.path.basename(path)}")
                    continue
                
                height, width = img.shape[:2]
                
                # Check image dimensions
                if width < self.min_image_size or height < self.min_image_size:
                    issues.append(f"Image too small: {os.path.basename(path)} ({width}x{height})")
                    recommendations.append("Use higher resolution images (at least 1024 pixels on the smallest dimension)")
                
                # Check for blurriness
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
                
                if blur_score < self.max_blur_threshold:
                    issues.append(f"Image is blurry: {os.path.basename(path)} (blur score: {blur_score:.2f})")
                    if len([i for i in issues if "blurry" in i]) <= 3:  # Limit redundant recommendations
                        recommendations.append("Use sharper images with good lighting conditions")
                
                # Calculate exposure (brightness)
                exposure = np.mean(gray)
                if exposure < 40:
                    issues.append(f"Image is too dark: {os.path.basename(path)} (mean brightness: {exposure:.2f})")
                    if "Ensure good lighting" not in recommendations:
                        recommendations.append("Ensure good lighting conditions when capturing images")
                elif exposure > 220:
                    issues.append(f"Image is overexposed: {os.path.basename(path)} (mean brightness: {exposure:.2f})")
                    if "Avoid overexposure" not in recommendations:
                        recommendations.append("Avoid overexposure by adjusting camera settings")
                
                # Store image quality information
                image_qualities.append({
                    "path": path,
                    "filename": os.path.basename(path),
                    "dimensions": f"{width}x{height}",
                    "blur_score": blur_score,
                    "exposure": exposure,
                    "quality_score": min(100, (blur_score / 10) * (min(1.0, min(exposure, 255-exposure) / 80)))
                })
                
            except Exception as e:
                issues.append(f"Error analyzing image {os.path.basename(path)}: {str(e)}")
        
        # Sort images by quality score
        image_qualities.sort(key=lambda x: x["quality_score"], reverse=True)
        
        # Calculate overall quality score - weighted average of top 80% of images
        n_best = max(1, int(len(image_qualities) * 0.8))
        if image_qualities:
            best_images = image_qualities[:n_best]
            quality_score = sum(img["quality_score"] for img in best_images) / len(best_images)
            
            # Normalize to 0-100 range
            quality_score = min(100, max(0, quality_score))
        else:
            quality_score = 0
        
        # Estimate coverage score based on number of images
        # This is a simplified approach - a better approach would analyze actual coverage
        coverage_score = min(100, max(0, (len(image_qualities) - self.min_image_count) * 10 + 50))
        
        return {
            "quality_score": quality_score,
            "coverage_score": coverage_score,
            "sufficient_quality": quality_score >= 60 and coverage_score >= 60,
            "image_details": image_qualities,
            "issues": issues,
            "recommendations": list(set(recommendations))  # Remove duplicates
        }
    
    def analyze_coverage(self, image_paths: List[str]) -> float:
        """
        Analyze image coverage to ensure sufficient overlap
        
        This is a placeholder for a more sophisticated algorithm that would:
        1. Extract SIFT/ORB features from all images
        2. Match features between image pairs
        3. Build a graph of image connections
        4. Analyze the connectivity to ensure sufficient overlap
        
        Args:
            image_paths: List of paths to image files
            
        Returns:
            Coverage score (0-100)
        """
        # Simple implementation based on image count
        # A real implementation would analyze feature matches between images
        coverage_score = min(100, max(0, (len(image_paths) - self.min_image_count) * 10 + 50))
        return coverage_score


class FeatureExtractor:
    """
    Enhanced feature extraction with automatic parameter tuning
    and multiple detection algorithms
    """
    def __init__(self):
        self.feature_types = ["sift", "orb", "akaze"]
        self.default_feature = "sift"
    
    def extract_features(self, image_path: str, feature_type: str = None) -> Tuple[List[cv2.KeyPoint], np.ndarray]:
        """
        Extract features from an image using the specified feature detector
        
        Args:
            image_path: Path to the image file
            feature_type: Type of feature detector to use (default: self.default_feature)
            
        Returns:
            Tuple of (keypoints, descriptors)
        """
        if feature_type is None:
            feature_type = self.default_feature
            
        feature_type = feature_type.lower()
        
        if feature_type not in self.feature_types:
            raise ValueError(f"Unsupported feature type: {feature_type}. Supported types: {', '.join(self.feature_types)}")
        
        # Load image
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"Unable to load image: {image_path}")
        
        # Initialize detector based on feature type
        if feature_type == "sift":
            detector = cv2.SIFT_create(nfeatures=0, contrastThreshold=0.04, edgeThreshold=10)
        elif feature_type == "orb":
            detector = cv2.ORB_create(nfeatures=10000, scaleFactor=1.2, nlevels=8)
        elif feature_type == "akaze":
            detector = cv2.AKAZE_create()
        
        # Extract features
        keypoints, descriptors = detector.detectAndCompute(img, None)
        
        return keypoints, descriptors
    
    def adaptive_feature_extraction(self, image_path: str) -> Tuple[str, List[cv2.KeyPoint], np.ndarray]:
        """
        Try different feature extraction algorithms and parameters
        to find the best one for the given image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Tuple of (feature_type, keypoints, descriptors)
        """
        # Try all feature types and select the one with most keypoints
        best_feature_type = None
        best_keypoints = None
        best_descriptors = None
        max_keypoints = 0
        
        for feature_type in self.feature_types:
            try:
                keypoints, descriptors = self.extract_features(image_path, feature_type)
                
                if keypoints and len(keypoints) > max_keypoints:
                    best_feature_type = feature_type
                    best_keypoints = keypoints
                    best_descriptors = descriptors
                    max_keypoints = len(keypoints)
            except Exception as e:
                logger.warning(f"Feature extraction failed for {feature_type}: {e}")
                continue
        
        if best_feature_type is None:
            raise ValueError(f"All feature extraction methods failed for image: {image_path}")
            
        return best_feature_type, best_keypoints, best_descriptors


def is_valid_image(filename: str) -> bool:
    """
    Check if file is a valid image based on extension and basic validation
    
    Args:
        filename: Name of the file to check
        
    Returns:
        True if the file is a valid image, False otherwise
    """
    allowed_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"}
    file_ext = os.path.splitext(filename.lower())[1]
    
    # Check file extension
    if file_ext not in allowed_extensions:
        return False
    
    # If OpenCV is available, try to open the image
    try:
        img = cv2.imread(filename)
        return img is not None and img.size > 0
    except:
        # Fall back to extension check only
        return True


def extract_camera_params(job_id: str, job: JobStatus) -> Tuple[bool, str]:
    """
    Enhanced camera parameter extraction with adaptive parameters and multiple fallbacks
    
    Args:
        job_id: ID of the processing job
        job: JobStatus object to track progress
        
    Returns:
        Tuple of (success, transforms_path or error_message)
    """
    job.start_stage("extract_camera_params", "Extracting camera parameters...")
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
                      is_valid_image(os.path.join(images_dir, f))]
        
        if len(image_files) < 3:
            job.end_stage("extract_camera_params", False)
            return False, f"Not enough images: {len(image_files)} (minimum 3 required)"
            
        logger.info(f"Processing {len(image_files)} images")
        
        # Analyze image quality
        image_analyzer = ImageQualityAnalyzer()
        image_paths = [os.path.join(images_dir, f) for f in image_files]
        quality_analysis = image_analyzer.analyze_images(image_paths)
        
        # Update job with image quality information
        job.update_image_metadata(
            image_count=len(image_files),
            quality_score=quality_analysis["quality_score"],
            coverage_score=quality_analysis["coverage_score"]
        )
        
        # Log quality issues as warnings
        for issue in quality_analysis.get("issues", []):
            job.add_warning(issue)
            
        # Determine COLMAP parameters based on image quality
        colmap_params = {}
        
        # Adjust feature extraction parameters based on image quality
        if quality_analysis["quality_score"] < 50:
            # For low quality images, use more permissive parameters
            colmap_params.update({
                "--ImageReader.single_camera": "1",
                "--SiftExtraction.use_gpu": "1" if USE_GPU else "0",
                "--SiftExtraction.max_num_features": "16384",  # Extract more features for low quality images
                "--SiftExtraction.first_octave": "-1",        # Start at full resolution
                "--SiftExtraction.edge_threshold": "20",       # More permissive edge detection
                "--SiftExtraction.peak_threshold": "0.002"     # Lower threshold for detecting features
            })
        else:
            # For good quality images, use standard parameters
            colmap_params.update({
                "--ImageReader.single_camera": "1",
                "--SiftExtraction.use_gpu": "1" if USE_GPU else "0"
            })
        
        # Step 1: Run COLMAP feature extraction with adapted parameters
        feature_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "feature_extractor",
            "--database_path", db_path,
            "--image_path", images_dir
        ]
        
        # Add dynamic parameters
        for param, value in colmap_params.items():
            feature_cmd.extend([param, value])
        
        logger.info(f"Running COLMAP feature extraction: {' '.join(feature_cmd)}")
        job.update("processing", "Extracting image features...", 25)
        
        try:
            result = subprocess.run(
                feature_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
                timeout=600  # 10 minutes timeout
            )
            logger.debug(f"Feature extraction stdout: {result.stdout}")
            logger.debug(f"Feature extraction stderr: {result.stderr}")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            logger.warning(f"Feature extraction failed with standard parameters, trying alternative parameters")
            
            # Try with alternative parameters
            retry_params = ERROR_TYPES["colmap_feature_extraction_failed"]["retry_with"]
            alternative_cmd = feature_cmd.copy()
            
            for param, value in retry_params.items():
                param_name = f"--{param}"
                param_index = -1
                
                # Check if parameter already exists in command
                for i, arg in enumerate(alternative_cmd):
                    if arg == param_name:
                        param_index = i
                        break
                
                if param_index >= 0 and param_index + 1 < len(alternative_cmd):
                    # Replace existing parameter
                    alternative_cmd[param_index + 1] = str(value)
                else:
                    # Add new parameter
                    alternative_cmd.extend([param_name, str(value)])
            
            logger.info(f"Trying alternative feature extraction: {' '.join(alternative_cmd)}")
            
            try:
                result = subprocess.run(
                    alternative_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True,
                    timeout=600  # 10 minutes timeout
                )
                logger.info(f"Alternative feature extraction succeeded")
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                logger.error(f"Feature extraction failed with alternative parameters: {e}")
                
                # Use manual feature extraction fallback
                job.add_warning("COLMAP feature extraction failed, using fallback feature extraction")
                
                try:
                    # Use OpenCV-based feature extraction as fallback
                    feature_extractor = FeatureExtractor()
                    
                    # Extract features for each image
                    features_dir = os.path.join(output_dir, "manual_features")
                    os.makedirs(features_dir, exist_ok=True)
                    
                    successful_extractions = 0
                    for img_file in image_files:
                        try:
                            img_path = os.path.join(images_dir, img_file)
                            feature_type, keypoints, descriptors = feature_extractor.adaptive_feature_extraction(img_path)
                            
                            # Save features to file for debugging/validation
                            np.savez(
                                os.path.join(features_dir, f"{img_file}.features.npz"),
                                feature_type=feature_type,
                                keypoints=np.array([[kp.pt[0], kp.pt[1], kp.size, kp.angle, kp.response, kp.octave, kp.class_id] for kp in keypoints]),
                                descriptors=descriptors
                            )
                            
                            successful_extractions += 1
                        except Exception as feat_err:
                            logger.warning(f"Manual feature extraction failed for {img_file}: {feat_err}")
                    
                    # Log success rate
                    extraction_rate = successful_extractions / len(image_files) if image_files else 0
                    logger.info(f"Manual feature extraction success rate: {extraction_rate:.2f} ({successful_extractions}/{len(image_files)})")
                    
                    if extraction_rate < 0.5:
                        # If less than 50% of images processed successfully, give up
                        raise ValueError(f"Manual feature extraction failed for most images")
                        
                    # TODO: Implement manual feature matching and reconstruction
                    # For now, proceed with creating a fallback transforms.json
                    job.add_warning("Using synthetic camera positions as fallback")
                    return create_fallback_transforms(job_id, images_dir, output_dir, job)
                        
                except Exception as manual_err:
                    logger.error(f"Manual feature extraction failed: {manual_err}")
                    job.end_stage("extract_camera_params", False)
                    return False, f"Feature extraction failed: {str(e)}"
        
        # Step 2: Run COLMAP matching with custom parameters
        matcher_params = {}
        
        # Adjust matching parameters based on image quality and count
        if quality_analysis["quality_score"] < 50 or len(image_files) < 10:
            # Use exhaustive matcher for few or low-quality images
            matcher_type = "exhaustive_matcher"
            matcher_params.update({
                "--SiftMatching.use_gpu": "1" if USE_GPU else "0",
                "--SiftMatching.max_ratio": "0.9",  # More permissive ratio test (default is 0.8)
                "--SiftMatching.max_distance": "0.7",  # More permissive distance threshold
                "--SiftMatching.cross_check": "1"  # Enable cross-checking for more reliable matches
            })
        else:
            # Use spatial matcher for many good-quality images (faster)
            matcher_type = "spatial_matcher"
            matcher_params.update({
                "--SiftMatching.use_gpu": "1" if USE_GPU else "0",
                "--SpatialMatching.max_num_neighbors": "12"
            })
        
        matcher_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", matcher_type,
            "--database_path", db_path
        ]
        
        # Add dynamic parameters
        for param, value in matcher_params.items():
            matcher_cmd.extend([param, value])
        
        job.update("processing", f"Matching image features...", 40)
        logger.info(f"Running COLMAP matcher: {' '.join(matcher_cmd)}")
        
        try:
            result = subprocess.run(
                matcher_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
                timeout=1200  # 20 minutes timeout
            )
            logger.debug(f"Matcher stdout: {result.stdout}")
            logger.debug(f"Matcher stderr: {result.stderr}")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            logger.warning(f"Matching failed with {matcher_type}, trying alternative matcher")
            
            # Try alternative matcher
            if matcher_type == "exhaustive_matcher":
                alternative_matcher = "sequential_matcher"
                alternative_params = {
                    "--SiftMatching.use_gpu": "1" if USE_GPU else "0",
                    "--SequentialMatching.overlap": "10",
                    "--SequentialMatching.quadratic_overlap": "1",
                    "--SequentialMatching.loop_detection": "1",
                    "--SequentialMatching.loop_detection_period": "10"
                }
            else:
                alternative_matcher = "exhaustive_matcher"
                alternative_params = {
                    "--SiftMatching.use_gpu": "1" if USE_GPU else "0",
                    "--SiftMatching.max_ratio": "0.9",
                    "--SiftMatching.max_distance": "0.7",
                    "--SiftMatching.cross_check": "1"
                }
            
            alternative_cmd = [
                "xvfb-run", "-a",
                "colmap", alternative_matcher,
                "--database_path", db_path
            ]
            
            # Add dynamic parameters
            for param, value in alternative_params.items():
                alternative_cmd.extend([param, value])
            
            logger.info(f"Trying alternative matcher: {' '.join(alternative_cmd)}")
            
            try:
                result = subprocess.run(
                    alternative_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True,
                    timeout=1200  # 20 minutes timeout
                )
                logger.info(f"Alternative matcher succeeded")
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                logger.error(f"All matching methods failed: {e}")
                job.add_warning("Failed to match features between images. The images may not have enough overlap.")
                job.end_stage("extract_camera_params", False)
                return create_fallback_transforms(job_id, images_dir, output_dir, job)
        
        # Step 3: Run COLMAP mapper/reconstruction with adaptive parameters
        mapper_params = {}
        
        # Adjust mapper parameters based on image quality
        if quality_analysis["quality_score"] < 50:
            # More permissive parameters for low quality images
            mapper_params.update({
                "--Mapper.min_model_size": "3",  # Reduce minimum model size (default is 10)
                "--Mapper.init_min_num_inliers": "15",  # Reduce minimum inliers for initialization
                "--Mapper.abs_pose_min_num_inliers": "7",  # Lower threshold for adding images
                "--Mapper.abs_pose_min_inlier_ratio": "0.25",  # Lower ratio threshold
                "--Mapper.ba_global_max_num_iterations": "50",  # More bundle adjustment iterations
                "--Mapper.ba_global_max_refinements": "5",  # More refinement iterations
                "--Mapper.ba_local_max_num_iterations": "30",  # More local BA iterations
                "--Mapper.init_max_reg_trials": "5",  # Try more registration trials for initialization
                "--Mapper.min_focal_length_ratio": "0.1",  # More permissive focal length
                "--Mapper.max_focal_length_ratio": "10.0",  # More permissive focal length
                "--Mapper.max_extra_param": "1.0"  # More permissive distortion parameters
            })
        else:
            # Standard parameters for good quality images
            mapper_params.update({
                "--Mapper.ba_global_max_num_iterations": "30",
                "--Mapper.ba_local_max_num_iterations": "20"
            })
        
        mapper_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "mapper",
            "--database_path", db_path,
            "--image_path", images_dir,
            "--output_path", sparse_dir
        ]
        
        # Add dynamic parameters
        for param, value in mapper_params.items():
            mapper_cmd.extend([param, value])
        
        job.update("processing", "Building 3D reconstruction...", 60)
        logger.info(f"Running COLMAP mapper: {' '.join(mapper_cmd)}")
        
        try:
            result = subprocess.run(
                mapper_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
                timeout=1800  # 30 minutes timeout
            )
            logger.debug(f"Mapper stdout: {result.stdout}")
            logger.debug(f"Mapper stderr: {result.stderr}")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            logger.warning(f"Mapper failed, trying with alternative parameters")
            
            # Try with alternative parameters
            retry_params = ERROR_TYPES["colmap_reconstruction_failed"]["retry_with"]
            alternative_cmd = mapper_cmd.copy()
            
            for param, value in retry_params.items():
                param_name = f"--{param}"
                param_index = -1
                
                # Check if parameter already exists in command
                for i, arg in enumerate(alternative_cmd):
                    if arg == param_name:
                        param_index = i
                        break
                
                if param_index >= 0 and param_index + 1 < len(alternative_cmd):
                    # Replace existing parameter
                    alternative_cmd[param_index + 1] = str(value)
                else:
                    # Add new parameter
                    alternative_cmd.extend([param_name, str(value)])
            
            logger.info(f"Trying alternative mapper: {' '.join(alternative_cmd)}")
            
            try:
                result = subprocess.run(
                    alternative_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True,
                    timeout=1800  # 30 minutes timeout
                )
                logger.info(f"Alternative mapper succeeded")
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                logger.error(f"Mapper failed with alternative parameters: {e}")
                job.add_warning("COLMAP reconstruction failed, using fallback method")
                job.end_stage("extract_camera_params", False)
                return create_fallback_transforms(job_id, images_dir, output_dir, job)
        
        # Check if reconstruction was successful
        sparse_model_dir = os.path.join(sparse_dir, "0")
        if not os.path.exists(sparse_model_dir):
            logger.warning("COLMAP mapper did not produce any reconstructions")
            job.add_warning("COLMAP reconstruction did not produce any results, using fallback method")
            job.end_stage("extract_camera_params", False)
            return create_fallback_transforms(job_id, images_dir, output_dir, job)
        
        # Step 4: Convert to text format
        text_dir = os.path.join(output_dir, "text")
        os.makedirs(text_dir, exist_ok=True)
        
        converter_cmd = [
            "xvfb-run", "-a",  # Use Xvfb to provide virtual display
            "colmap", "model_converter",
            "--input_path", sparse_model_dir,
            "--output_path", text_dir,
            "--output_type", "TXT"
        ]
        
        job.update("processing", "Converting reconstruction format...", 70)
        logger.info(f"Running COLMAP model converter: {' '.join(converter_cmd)}")
        
        try:
            result = subprocess.run(
                converter_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
                timeout=300  # 5 minutes timeout
            )
            logger.debug(f"Model converter stdout: {result.stdout}")
            logger.debug(f"Model converter stderr: {result.stderr}")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            logger.error(f"Model converter failed: {e}")
            job.add_warning("COLMAP model conversion failed, using fallback method")
            job.end_stage("extract_camera_params", False)
            return create_fallback_transforms(job_id, images_dir, output_dir, job)
        
        # Step 5: Convert COLMAP format to transforms.json for Instant-NGP
        # Check if the required files exist
        cameras_file = os.path.join(text_dir, "cameras.txt")
        images_file = os.path.join(text_dir, "images.txt")
        
        if os.path.exists(cameras_file) and os.path.exists(images_file):
            # Convert COLMAP text format to transforms.json
            success = convert_colmap_to_transforms(text_dir, images_dir, transforms_path)
            
            if not success:
                logger.warning(f"Failed to convert COLMAP text format to transforms.json")
                job.add_warning("Failed to convert COLMAP output to NeRF format, using fallback method")
                job.end_stage("extract_camera_params", False)
                return create_fallback_transforms(job_id, images_dir, output_dir, job)
        else:
            logger.warning(f"COLMAP text files not found at {text_dir}")
            job.add_warning("COLMAP text files not found, using fallback method")
            job.end_stage("extract_camera_params", False)
            return create_fallback_transforms(job_id, images_dir, output_dir, job)
        
        if os.path.exists(transforms_path):
            job.end_stage("extract_camera_params", True)
            return True, transforms_path
        else:
            job.end_stage("extract_camera_params", False)
            return False, "Failed to generate transforms.json file"
            
    except Exception as e:
        logger.error(f"Unexpected error in extract_camera_params: {e}")
        logger.error(traceback.format_exc())
        job.end_stage("extract_camera_params", False)
        return create_fallback_transforms(job_id, images_dir, output_dir, job)


def convert_colmap_to_transforms(colmap_dir, images_dir, transforms_path):
    """
    Enhanced conversion from COLMAP text format to transforms.json for Instant-NGP
    with improved error handling and additional metadata
    
    Args:
        colmap_dir: Path to COLMAP text output directory
        images_dir: Path to input images directory
        transforms_path: Path to output transforms.json
        
    Returns:
        True if conversion was successful, False otherwise
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
        
        # Read points3D.txt if it exists to get estimated scale
        points3D = []
        scale_factor = 1.0
        points3D_file = os.path.join(colmap_dir, "points3D.txt")
        
        if os.path.exists(points3D_file):
            with open(points3D_file, "r") as f:
                for line in f:
                    if line.startswith("#") or line.strip() == "":
                        continue
                    parts = line.split()
                    point_id = int(parts[0])
                    x, y, z = [float(coord) for coord in parts[1:4]]
                    r, g, b = [int(color) for color in parts[4:7]]
                    error = float(parts[7])
                    # Skip track info (image IDs and point indexes)
                    
                    points3D.append({
                        "id": point_id,
                        "position": [x, y, z],
                        "color": [r, g, b],
                        "error": error
                    })
            
            # Estimate scale based on point cloud dimensions (very rough estimation)
            if points3D:
                # Calculate bounding box
                positions = np.array([p["position"] for p in points3D])
                min_coords = np.min(positions, axis=0)
                max_coords = np.max(positions, axis=0)
                dimensions = max_coords - min_coords
                
                # Estimate dimensions in meters assuming this is a typical residential roof
                # Typical residential roof dimensions are ~10-20m
                longest_dimension = np.max(dimensions)
                if longest_dimension > 0:
                    # Scale to reasonable size (assuming target of ~15m longest dimension)
                    scale_factor = 15.0 / longest_dimension
                    logger.info(f"Estimated scale factor: {scale_factor}")
        
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
            
        # Calculate average camera distance from center
        if len(images) > 1:
            positions = np.array([quaternion_to_rotation_matrix(img["qvec"]) @ (-np.array(img["tvec"])) for img in images.values()])
            center = np.mean(positions, axis=0)
            distances = np.linalg.norm(positions - center, axis=1)
            avg_distance = np.mean(distances)
            logger.info(f"Average camera distance from center: {avg_distance}")
            
            # Use average distance to refine scale factor if needed
            if 5.0 < avg_distance < 100.0:
                # Reasonable values for roof photography - no adjustment needed
                pass
            elif avg_distance <= 5.0:
                # Cameras are too close, likely wrong scale
                scale_factor *= 5.0 / max(0.1, avg_distance)
                logger.info(f"Adjusted scale factor (cameras too close): {scale_factor}")
            elif avg_distance >= 100.0:
                # Cameras are too far, likely wrong scale
                scale_factor *= 20.0 / avg_distance
                logger.info(f"Adjusted scale factor (cameras too far): {scale_factor}")
        
        # Create transforms.json
        transforms = {
            "camera_angle_x": camera_angle_x,
            "frames": [],
            "metadata": {
                "scale_factor": scale_factor,
                "num_cameras": len(cameras),
                "num_images": len(images),
                "num_points": len(points3D),
                "creation_time": datetime.now().isoformat()
            }
        }
        
        # Add information about camera models
        camera_models = {}
        for camera_id, camera in cameras.items():
            camera_models[camera_id] = {
                "model": camera["model"],
                "width": camera["width"],
                "height": camera["height"],
                "params": camera["params"]
            }
        transforms["metadata"]["camera_models"] = camera_models
        
        for image_id, image_data in images.items():
            # Calculate rotation matrix from quaternion
            qvec = image_data["qvec"]
            tvec = image_data["tvec"]
            R = quaternion_to_rotation_matrix(qvec)
            
            # Apply scale factor to translation
            scaled_tvec = [t * scale_factor for t in tvec]
            
            # Create transform matrix
            transform = np.zeros((4, 4))
            transform[:3, :3] = R
            transform[:3, 3] = scaled_tvec
            transform[3, 3] = 1.0
            
            # Convert to Instant NGP format
            # NeRF uses a different coordinate system than COLMAP
            nerf_transform = convert_to_nerf_format(transform)
            
            # Get camera parameters
            camera_id = image_data["camera_id"]
            camera = cameras[camera_id]
            
            # Add frame to transforms.json
            frame = {
                "file_path": image_data["name"],
                "transform_matrix": nerf_transform.tolist(),
                "camera_id": camera_id,
                "width": camera["width"],
                "height": camera["height"]
            }
            
            # Add focal length information if available
            if camera["model"] in ["SIMPLE_PINHOLE", "PINHOLE", "SIMPLE_RADIAL"]:
                focal_length = camera["params"][0]
                frame["fl_x"] = focal_length
                frame["fl_y"] = focal_length
                
                # Add principal point if available
                if camera["model"] in ["PINHOLE"]:
                    frame["cx"] = camera["params"][2]
                    frame["cy"] = camera["params"][3]
                elif camera["model"] in ["SIMPLE_RADIAL"]:
                    # For SIMPLE_RADIAL, principal point is at params[1], params[2]
                    if len(camera["params"]) >= 3:
                        frame["cx"] = camera["params"][1]
                        frame["cy"] = camera["params"][2]
                else:
                    # Default to center of image
                    frame["cx"] = camera["width"] / 2
                    frame["cy"] = camera["height"] / 2
            
            transforms["frames"].append(frame)
        
        # Write transforms.json
        with open(transforms_path, 'w') as f:
            json.dump(transforms, f, indent=2)
        
        logger.info(f"Created transforms.json with {len(transforms['frames'])} frames")
        
        return True
    except Exception as e:
        logger.error(f"Error in convert_colmap_to_transforms: {e}")
        logger.error(traceback.format_exc())
        return False


def quaternion_to_rotation_matrix(qvec):
    """
    Convert quaternion to rotation matrix
    
    Args:
        qvec: Quaternion in [w, x, y, z] format
        
    Returns:
        3x3 rotation matrix
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
    
    Args:
        transform: 4x4 camera transform matrix from COLMAP
        
    Returns:
        4x4 transform matrix in NeRF format
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


def create_fallback_transforms(job_id, images_dir, output_dir, job=None):
    """
    Create a fallback transforms.json with sophisticated synthetic camera positions
    when COLMAP reconstruction fails
    
    Args:
        job_id: ID of the processing job
        images_dir: Directory containing input images
        output_dir: Directory to store output files
        job: JobStatus object to track progress (optional)
        
    Returns:
        Tuple of (success, transforms_path or error_message)
    """
    try:
        if job:
            job.start_stage("create_fallback_transforms", "Creating fallback camera positions...")
            job.update("processing", "Creating synthetic camera positions...", 60)
            
        logger.info("Creating fallback transforms.json")
        
        transforms_path = os.path.join(output_dir, "transforms.json")
        
        # Get all image files
        image_files = []
        for f in os.listdir(images_dir):
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff')):
                image_files.append(f)
        
        if len(image_files) < 3:
            if job:
                job.end_stage("create_fallback_transforms", False)
            return False, "Not enough images for 3D reconstruction (minimum 3 required)"
        
        logger.info(f"Creating fallback transforms with {len(image_files)} images")
        
        # Try to extract roof structure from images for better camera placement
        roof_type = "unknown"
        try:
            # Basic image analysis to attempt to determine roof type
            image_analyzer = detect_roof_type(images_dir, image_files[:min(5, len(image_files))])
            roof_type = image_analyzer.get("roof_type", "unknown")
            logger.info(f"Detected roof type: {roof_type}")
            
            if job:
                job.update_processing_options({"roof_type_hint": roof_type})
        except Exception as e:
            logger.warning(f"Failed to detect roof type: {e}")
            # Default to unknown roof type
        
        # Create a basic transforms structure
        transforms = {
            "camera_angle_x": 0.8575560450553894,  # ~45 degrees in radians
            "frames": [],
            "metadata": {
                "synthetic": True,
                "creation_method": "fallback",
                "roof_type": roof_type,
                "num_images": len(image_files),
                "creation_time": datetime.now().isoformat()
            }
        }
        
        # Create a more sophisticated camera arrangement based on detected roof type
        if roof_type == "gable":
            # For gable roofs, place cameras along two circular paths on opposite sides
            transforms["frames"] = create_gable_roof_cameras(image_files)
        elif roof_type == "hip":
            # For hip roofs, place cameras in circular arrangement with some elevation variation
            transforms["frames"] = create_hip_roof_cameras(image_files)
        elif roof_type == "flat":
            # For flat roofs, place cameras in a grid pattern above the roof
            transforms["frames"] = create_flat_roof_cameras(image_files)
        else:
            # Default arrangement - circular with variable height
            transforms["frames"] = create_default_cameras(image_files)
        
        # Write transforms.json
        with open(transforms_path, 'w') as f:
            json.dump(transforms, f, indent=2)
        
        if os.path.exists(transforms_path):
            if job:
                job.end_stage("create_fallback_transforms", True)
            return True, transforms_path
        else:
            if job:
                job.end_stage("create_fallback_transforms", False)
            return False, "Failed to create fallback transforms.json"
            
    except Exception as e:
        logger.error(f"Error in create_fallback_transforms: {e}")
        logger.error(traceback.format_exc())
        if job:
            job.end_stage("create_fallback_transforms", False)
        return False, f"Error creating fallback transforms: {e}"


def detect_roof_type(images_dir, sample_image_files):
    """
    Detect the roof type based on image analysis
    
    Args:
        images_dir: Directory containing input images
        sample_image_files: List of image files to analyze
        
    Returns:
        Dictionary with detected roof type and confidence level
    """
    try:
        # Check if ML model server is available for more accurate detection
        if MLM_SERVER_URL:
            try:
                # Prepare image data for ML model
                image_data = []
                for image_file in sample_image_files[:3]:  # Limit to 3 images for efficiency
                    img_path = os.path.join(images_dir, image_file)
                    img = cv2.imread(img_path)
                    if img is None:
                        continue
                    
                    # Resize image to standard size
                    img = cv2.resize(img, (512, 512))
                    
                    # Convert to base64 for API transmission
                    _, buffer = cv2.imencode('.jpg', img)
                    img_b64 = base64.b64encode(buffer).decode('utf-8')
                    image_data.append(img_b64)
                
                if not image_data:
                    raise ValueError("No valid images for roof type detection")
                
                # Call ML model server
                payload = {
                    "images": image_data,
                    "model": "roof_type_classifier"
                }
                
                response = requests.post(
                    f"{MLM_SERVER_URL}/predict",
                    json=payload,
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "roof_type": result.get("roof_type", "unknown"),
                        "confidence": result.get("confidence", 0.0),
                        "method": "ml_model"
                    }
            except Exception as e:
                logger.warning(f"ML-based roof type detection failed: {e}")
                # Fall back to simpler detection method
        
        # Simple heuristic-based roof type detection as fallback
        # Detect lines in images and analyze their orientation
        gable_votes = 0
        hip_votes = 0
        flat_votes = 0
        
        for image_file in sample_image_files:
            img_path = os.path.join(images_dir, image_file)
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Detect edges
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            
            # Detect lines using Hough transform
            lines = cv2.HoughLinesP(
                edges, 
                rho=1, 
                theta=np.pi/180, 
                threshold=100, 
                minLineLength=100, 
                maxLineGap=10
            )
            
            if lines is None:
                continue
            
            # Analyze line orientations
            horizontal_lines = 0
            vertical_lines = 0
            diagonal_lines = 0
            
            for line in lines:
                x1, y1, x2, y2 = line[0]
                dx = x2 - x1
                dy = y2 - y1
                
                # Skip very short lines
                if dx*dx + dy*dy < 10000:  # Minimum length threshold
                    continue
                
                angle = abs(math.degrees(math.atan2(dy, dx)) % 180)
                
                # Classify line orientation
                if angle < 15 or angle > 165:
                    horizontal_lines += 1
                elif 75 < angle < 105:
                    vertical_lines += 1
                else:
                    diagonal_lines += 1
            
            # Classify image based on line patterns
            if horizontal_lines > vertical_lines and horizontal_lines > diagonal_lines:
                flat_votes += 1
            elif diagonal_lines > 0 and vertical_lines > 0:
                # Gable roofs typically have strong diagonal and vertical lines
                gable_votes += 1
            elif diagonal_lines > 0:
                # Hip roofs typically have diagonal lines in multiple directions
                hip_votes += 1
        
        # Determine most likely roof type
        if flat_votes > gable_votes and flat_votes > hip_votes:
            roof_type = "flat"
            confidence = flat_votes / len(sample_image_files)
        elif gable_votes > hip_votes:
            roof_type = "gable"
            confidence = gable_votes / len(sample_image_files)
        elif hip_votes > 0:
            roof_type = "hip"
            confidence = hip_votes / len(sample_image_files)
        else:
            roof_type = "unknown"
            confidence = 0.0
        
        return {
            "roof_type": roof_type,
            "confidence": confidence,
            "method": "heuristic"
        }
    
    except Exception as e:
        logger.warning(f"Roof type detection failed: {e}")
        return {
            "roof_type": "unknown",
            "confidence": 0.0,
            "method": "failed"
        }


def create_default_cameras(image_files):
    """
    Create default camera positions in a circular arrangement with variable height
    
    Args:
        image_files: List of image files
        
    Returns:
        List of frame dictionaries for transforms.json
    """
    frames = []
    
    # Number of images
    num_images = len(image_files)
    
    # Parameters for camera placement
    radius = 4.0  # Distance from center
    height_min = 1.0
    height_max = 3.0
    
    for i, img_name in enumerate(image_files):
        # Calculate position on a circle with some random variation in height
        theta = i * 2 * math.pi / num_images
        x = radius * math.cos(theta)
        y = radius * math.sin(theta)
        
        # Vary height to create more realistic camera positions
        # Use sinusoidal variation for smoothness
        z = height_min + (height_max - height_min) * 0.5 * (1 + math.sin(theta * 2))
        
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
        frames.append(frame)
    
    return frames


def create_gable_roof_cameras(image_files):
    """
    Create camera positions optimized for gable roofs
    
    Args:
        image_files: List of image files
        
    Returns:
        List of frame dictionaries for transforms.json
    """
    frames = []
    
    # Number of images
    num_images = len(image_files)
    
    # Parameters for camera placement
    radius = 4.5  # Distance from center
    length = 5.0  # Roof length along ridge
    height = 2.5  # Roof height
    
    # Roof orientation - assume ridge along x-axis
    ridge_dir = np.array([1, 0, 0])
    
    # Distribute cameras along two circular paths on opposite sides of the roof
    # with additional cameras at the gable ends
    for i, img_name in enumerate(image_files):
        if i < num_images // 2:
            # First half of cameras - one side of the roof
            progress = i / (num_images // 2 - 1) if num_images > 2 else 0
            angle = math.pi * (0.25 + 0.5 * progress)  # 45 to 135 degrees
            
            x = length * (progress - 0.5)  # Position along ridge
            y = radius * math.cos(angle)
            z = radius * math.sin(angle) * 0.8  # Lower height multiplier
        else:
            # Second half of cameras - other side of the roof
            progress = (i - num_images // 2) / (num_images - num_images // 2 - 1) if num_images > 2 else 0
            angle = math.pi * (0.75 + 0.5 * progress)  # 135 to 225 degrees
            
            x = length * (progress - 0.5)  # Position along ridge
            y = radius * math.cos(angle)
            z = radius * math.sin(angle) * 0.8  # Lower height multiplier
        
        # Add some variation to prevent perfect regularity
        jitter = 0.2
        x += (np.random.random() - 0.5) * jitter
        y += (np.random.random() - 0.5) * jitter
        z += (np.random.random() - 0.5) * jitter + height
        
        # Create a "look-at-center" transform
        from_pos = np.array([x, y, z])
        
        # Look at nearest point on the ridge
        ridge_pos = np.array([x, 0, height])
        to_pos = ridge_pos
        
        up = np.array([0, 0, 1])  # Z is up
        
        transform = create_look_at_matrix(from_pos, to_pos, up)
        
        # Add frame to transforms
        frame = {
            "file_path": img_name,
            "transform_matrix": transform.tolist()
        }
        frames.append(frame)
    
    return frames


def create_hip_roof_cameras(image_files):
    """
    Create camera positions optimized for hip roofs
    
    Args:
        image_files: List of image files
        
    Returns:
        List of frame dictionaries for transforms.json
    """
    frames = []
    
    # Number of images
    num_images = len(image_files)
    
    # Parameters for camera placement
    radius_base = 5.0  # Base distance from center
    height_min = 2.0
    height_max = 4.0
    
    # Distribute cameras around the roof with varying elevation
    for i, img_name in enumerate(image_files):
        # Calculate position on a circle with elevation variation
        theta = i * 2 * math.pi / num_images
        
        # Vary radius slightly to create more natural paths
        radius = radius_base * (1.0 + 0.1 * math.sin(theta * 3))
        
        x = radius * math.cos(theta)
        y = radius * math.sin(theta)
        
        # Calculate height with variation
        # Higher on the corners (hip joints), lower on the faces
        face_angle = theta % (math.pi/2)  # Angle within the current quadrant
        normalized_face_angle = min(face_angle, math.pi/2 - face_angle) / (math.pi/4)  # 0 at middle of face, 1 at corner
        
        # Height is maximum at corners, minimum at face centers
        height_factor = normalized_face_angle
        z = height_min + (height_max - height_min) * height_factor
        
        # Add some variation
        jitter = 0.3
        x += (np.random.random() - 0.5) * jitter
        y += (np.random.random() - 0.5) * jitter
        z += (np.random.random() - 0.5) * jitter
        
        # Create a "look-at-center" transform
        from_pos = np.array([x, y, z])
        to_pos = np.array([0, 0, height_min])  # Look at the middle height of the roof
        up = np.array([0, 0, 1])  # Z is up
        
        transform = create_look_at_matrix(from_pos, to_pos, up)
        
        # Add frame to transforms
        frame = {
            "file_path": img_name,
            "transform_matrix": transform.tolist()
        }
        frames.append(frame)
    
    return frames


def create_flat_roof_cameras(image_files):
    """
    Create camera positions optimized for flat roofs
    
    Args:
        image_files: List of image files
        
    Returns:
        List of frame dictionaries for transforms.json
    """
    frames = []
    
    # Number of images
    num_images = len(image_files)
    
    # Parameters for camera placement
    roof_size = 5.0  # Approximate roof size
    height_base = 3.0  # Base height above the roof
    
    # Prefer a grid-like distribution with higher view angles for flat roofs
    grid_size = math.ceil(math.sqrt(num_images))
    
    for i, img_name in enumerate(image_files):
        if i < num_images:
            # Calculate grid position
            row = i // grid_size
            col = i % grid_size
            
            # Convert to normalized coordinates
            norm_row = row / (grid_size - 1) if grid_size > 1 else 0.5
            norm_col = col / (grid_size - 1) if grid_size > 1 else 0.5
            
            # Calculate position
            x = (norm_col - 0.5) * roof_size * 2
            y = (norm_row - 0.5) * roof_size * 2
            
            # Vary height based on position - higher at corners
            corner_factor = 4 * (norm_row - 0.5)**2 * (norm_col - 0.5)**2
            z = height_base * (1 + corner_factor)
            
            # Add some variation
            jitter = 0.4
            x += (np.random.random() - 0.5) * jitter
            y += (np.random.random() - 0.5) * jitter
            z += (np.random.random() - 0.5) * jitter
            
            # Create a "look-at-center" transform with slight offset for straight-down views
            from_pos = np.array([x, y, z])
            to_pos = np.array([x * 0.2, y * 0.2, 0])  # Look at point slightly offset from directly below
            up = np.array([0, 1, 0])  # Y is up for flat roof views
            
            transform = create_look_at_matrix(from_pos, to_pos, up)
            
            # Add frame to transforms
            frame = {
                "file_path": img_name,
                "transform_matrix": transform.tolist()
            }
            frames.append(frame)
    
    return frames


def create_look_at_matrix(from_pos, to_pos, up=None):
    """
    Create a transformation matrix for a camera looking from 'from_pos' to 'to_pos'
    
    Args:
        from_pos: Camera position
        to_pos: Look-at position
        up: Up direction vector (default: [0, 0, 1])
        
    Returns:
        4x4 transformation matrix
    """
    if up is None:
        up = np.array([0, 0, 1])  # Default up direction (Z)
    
    # Calculate forward direction
    forward = to_pos - from_pos
    forward_norm = np.linalg.norm(forward)
    
    # Handle zero-length forward vector (from_pos == to_pos)
    if forward_norm < 1e-10:
        forward = np.array([0, 0, -1])  # Default forward direction
    else:
        forward = forward / forward_norm
    
    # Calculate right direction
    right = np.cross(forward, up)
    right_norm = np.linalg.norm(right)
    
    # Handle collinear up and forward
    if right_norm < 1e-10:
        # Choose a different up vector to avoid collinearity
        alternate_up = np.array([0, 1, 0]) if np.abs(np.dot(forward, np.array([0, 1, 0]))) < 0.9 else np.array([1, 0, 0])
        right = np.cross(forward, alternate_up)
        right = right / np.linalg.norm(right)
    else:
        right = right / right_norm
    
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
    Enhanced NeRF model generation with adaptive parameters and fallbacks
    
    Args:
        job_id: ID of the processing job
        transforms_path: Path to transforms.json file
        job: JobStatus object for progress tracking
        
    Returns:
        Tuple of (success, model_path or error_message)
    """
    job.start_stage("generate_nerf_model", "Generating 3D model...")
    job.update("processing", "Generating 3D model using Neural Radiance Fields...", 50)
    
    output_dir = os.path.join(OUTPUT_PATH, job_id)
    os.makedirs(output_dir, exist_ok=True)
    
    model_path = os.path.join(output_dir, "model.ingp")
    
    # Load transforms.json to check metadata
    try:
        with open(transforms_path, 'r') as f:
            transforms_data = json.load(f)
        
        # Check if this is a synthetic/fallback reconstruction
        is_synthetic = transforms_data.get("metadata", {}).get("synthetic", False)
        if is_synthetic:
            job.add_warning("Using synthetic camera positions for reconstruction")
            
        # Get roof type hint if available
        roof_type = transforms_data.get("metadata", {}).get("roof_type", "unknown")
        
        # Number of images
        num_frames = len(transforms_data.get("frames", []))
    except Exception as e:
        logger.warning(f"Failed to parse transforms.json: {e}")
        is_synthetic = False
        roof_type = "unknown"
        num_frames = 0
    
    # Determine NeRF training parameters based on image count, roof type, etc.
    training_steps = 5000  # Default number of training steps
    
    # Adjust based on image count
    if num_frames < 10:
        training_steps = 3000  # Fewer steps for fewer images
    elif num_frames > 30:
        training_steps = 7000  # More steps for many images
    
    # Adjust for synthetic reconstructions
    if is_synthetic:
        training_steps = 4000  # Balanced for synthetic camera positions
    
    # Adjust for roof type
    if roof_type == "flat":
        # Flat roofs are simpler, need fewer steps
        training_steps = max(2000, training_steps - 1000)
    elif roof_type == "complex":
        # Complex roofs need more training
        training_steps = training_steps + 2000
    
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
        has_marching_cubes = "--marching_cubes_res" in help_output
        has_n_steps = "--n_steps" in help_output
        use_mipmap = "--mip" in help_output
        use_width = "--width" in help_output
        use_height = "--height" in help_output
        
        # Build command with appropriate flags
        cmd = [f"{INSTANT_NGP_PATH}/build/instant-ngp", transforms_path]
        
        # Add UI control flag
        if use_no_gui:
            cmd.append("--no-gui")
        elif use_headless:
            cmd.append("--headless")
        
        # Add snapshot flag
        if has_save_snapshot:
            if "--save_snapshot" in help_output:
                cmd.extend(["--save_snapshot", model_path])
            else:
                cmd.extend(["--snapshot", model_path])
        
        # Add training steps if needed
        if has_n_steps:
            cmd.extend(["--n_steps", str(training_steps)])
        
        # Add resolution parameters if available
        if use_width and use_height:
            cmd.extend(["--width", "1024", "--height", "1024"])
        
        # Add mipmap levels for better detail
        if use_mipmap:
            cmd.extend(["--mip", "2"])
            
    except Exception as e:
        logger.warning(f"Error checking Instant NGP flags: {e}, using default flags")
        # Fallback to basic command if help check fails
        cmd = [
            f"{INSTANT_NGP_PATH}/build/instant-ngp",
            transforms_path,
            "--no-gui"
        ]
    
    logger.info(f"Running Instant NGP command: {' '.join(cmd)}")
    job.update("processing", f"Training NeRF model ({training_steps} steps)...", 55)
    
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
            timeout=3600  # 1 hour timeout
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
            
            job.end_stage("generate_nerf_model", success)
            return success, obj_path
        else:
            # Try alternative training parameters
            logger.warning("No model file produced, trying with alternative parameters")
            
            # Alternative parameters
            alt_cmd = cmd.copy()
            
            # Modify parameters for retry
            for i, arg in enumerate(alt_cmd):
                if arg == "--n_steps":
                    # Reduce steps for faster convergence
                    alt_cmd[i+1] = str(int(int(alt_cmd[i+1]) * 0.7))
                elif arg == "--mip":
                    # Reduce mipmap levels
                    alt_cmd[i+1] = "1"
            
            logger.info(f"Running alternative Instant NGP command: {' '.join(alt_cmd)}")
            job.update("processing", "Retrying with optimized parameters...", 60)
            
            try:
                result = subprocess.run(
                    alt_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True,
                    timeout=1800  # 30 minutes timeout
                )
                
                if os.path.exists(model_path):
                    # Export the model
                    job.update("processing", "Exporting model...", 80)
                    success, obj_path = export_model(job_id, model_path, job)
                    
                    job.end_stage("generate_nerf_model", success)
                    return success, obj_path
                else:
                    # Create a simple mesh directly
                    logger.warning("No model file found after retry, creating fallback mesh")
                    job.add_warning("NeRF training failed, using simplified mesh model")
                    
                    obj_path = os.path.join(output_dir, "model.obj")
                    success = create_fallback_mesh(obj_path, roof_type)
                    
                    if success and os.path.exists(obj_path):
                        job.end_stage("generate_nerf_model", True)
                        return True, obj_path
                    else:
                        job.end_stage("generate_nerf_model", False)
                        return False, "Failed to generate 3D model"
            
            except Exception as e:
                logger.error(f"Alternative training failed: {e}")
                job.add_warning("NeRF training failed, using simplified mesh model")
                
                # Create fallback mesh
                obj_path = os.path.join(output_dir, "model.obj")
                success = create_fallback_mesh(obj_path, roof_type)
                
                if success and os.path.exists(obj_path):
                    job.end_stage("generate_nerf_model", True)
                    return True, obj_path
                else:
                    job.end_stage("generate_nerf_model", False)
                    return False, f"NeRF training and fallback mesh generation failed: {e}"
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Instant NGP execution error: {e}")
        logger.error(f"stdout: {e.stdout}")
        logger.error(f"stderr: {e.stderr}")
        
        # Create fallback mesh
        obj_path = os.path.join(output_dir, "model.obj")
        success = create_fallback_mesh(obj_path, roof_type)
        
        if success and os.path.exists(obj_path):
            job.add_warning("NeRF training failed, using simplified mesh model")
            job.end_stage("generate_nerf_model", True)
            return True, obj_path
        else:
            job.end_stage("generate_nerf_model", False)
            return False, f"Error running Instant NGP: {e}"
    
    except Exception as e:
        logger.error(f"Unexpected error in generate_nerf_model: {e}")
        logger.error(traceback.format_exc())
        job.end_stage("generate_nerf_model", False)
        return False, f"Unexpected error: {e}"


def create_fallback_mesh(obj_path, roof_type="unknown"):
    """
    Create a sophisticated fallback mesh based on roof type
    when Instant NGP fails
    
    Args:
        obj_path: Path where the OBJ file should be saved
        roof_type: Type of roof to model (gable, hip, flat, etc.)
        
    Returns:
        True if creation was successful, False otherwise
    """
    try:
        vertices = []
        faces = []
        
        # Create a roof model based on the roof type
        if roof_type == "gable":
            # Create a simple gable roof
            # Base dimensions
            width = 10.0
            length = 15.0
            wall_height = 3.0
            roof_height = 3.0
            
            # Base vertices (clockwise, bottom then top)
            vertices = [
                # Base rectangle (bottom)
                (-length/2, -width/2, 0),
                (length/2, -width/2, 0),
                (length/2, width/2, 0),
                (-length/2, width/2, 0),
                
                # Wall top vertices
                (-length/2, -width/2, wall_height),
                (length/2, -width/2, wall_height),
                (length/2, width/2, wall_height),
                (-length/2, width/2, wall_height),
                
                # Ridge endpoints
                (-length/2, 0, wall_height + roof_height),
                (length/2, 0, wall_height + roof_height)
            ]
            
            # Faces (1-indexed for OBJ format)
            # Base and walls
            faces = [
                (1, 2, 3, 4),       # Base
                (1, 5, 6, 2),       # Front wall
                (2, 6, 7, 3),       # Right wall
                (3, 7, 8, 4),       # Back wall
                (4, 8, 5, 1),       # Left wall
                
                # Roof faces
                (5, 9, 10, 6),      # Front roof face
                (7, 6, 10, 9, 8),   # Back roof face
                (8, 9, 5)           # Left roof end
            ]
            
        elif roof_type == "hip":
            # Create a simple hip roof
            # Base dimensions
            width = 10.0
            length = 15.0
            wall_height = 3.0
            roof_height = 3.0
            
            # Base vertices
            vertices = [
                # Base rectangle (bottom)
                (-length/2, -width/2, 0),
                (length/2, -width/2, 0),
                (length/2, width/2, 0),
                (-length/2, width/2, 0),
                
                # Wall top vertices
                (-length/2, -width/2, wall_height),
                (length/2, -width/2, wall_height),
                (length/2, width/2, wall_height),
                (-length/2, width/2, wall_height),
                
                # Hip peak
                (0, 0, wall_height + roof_height)
            ]
            
            # Faces (1-indexed for OBJ format)
            faces = [
                (1, 2, 3, 4),       # Base
                (1, 5, 6, 2),       # Front wall
                (2, 6, 7, 3),       # Right wall
                (3, 7, 8, 4),       # Back wall
                (4, 8, 5, 1),       # Left wall
                
                # Roof faces (triangular)
                (5, 9, 6),          # Front roof
                (6, 9, 7),          # Right roof
                (7, 9, 8),          # Back roof
                (8, 9, 5)           # Left roof
            ]
            
        elif roof_type == "flat":
            # Create a simple flat roof
            # Base dimensions
            width = 12.0
            length = 16.0
            height = 3.5
            
            # Vertices for a rectangular prism
            vertices = [
                # Base
                (-length/2, -width/2, 0),
                (length/2, -width/2, 0),
                (length/2, width/2, 0),
                (-length/2, width/2, 0),
                
                # Top
                (-length/2, -width/2, height),
                (length/2, -width/2, height),
                (length/2, width/2, height),
                (-length/2, width/2, height)
            ]
            
            # Faces (1-indexed for OBJ format)
            faces = [
                (1, 2, 3, 4),       # Base
                (5, 6, 7, 8),       # Top (roof)
                (1, 5, 6, 2),       # Front
                (2, 6, 7, 3),       # Right
                (3, 7, 8, 4),       # Back
                (4, 8, 5, 1)        # Left
            ]
            
        else:
            # Create a simple cube mesh for unknown roof types
            vertices = [
                (-2, -2, -0.5), (2, -2, -0.5), (2, 2, -0.5), (-2, 2, -0.5),
                (-2, -2, 1.5), (2, -2, 1.5), (2, 2, 1.5), (-2, 2, 1.5),
                # Add a simple peak
                (0, 0, 3)
            ]
            
            faces = [
                (1, 2, 3, 4),      # Base
                (1, 5, 6, 2),      # Front
                (2, 6, 7, 3),      # Right
                (3, 7, 8, 4),      # Back
                (4, 8, 5, 1),      # Left
                (5, 9, 6),         # Front roof
                (6, 9, 7),         # Right roof
                (7, 9, 8),         # Back roof
                (8, 9, 5)          # Left roof
            ]
        
        # Write the OBJ file
        with open(obj_path, 'w') as f:
            f.write("# Fallback mesh generated by Roof 3D Analysis Server\n")
            f.write(f"# Roof type: {roof_type}\n")
            
            # Write vertices
            for v in vertices:
                f.write(f"v {v[0]} {v[1]} {v[2]}\n")
            
            # Write faces
            for face in faces:
                face_str = " ".join([str(idx) for idx in face])
                f.write(f"f {face_str}\n")
                
        logger.info(f"Created fallback mesh of type {roof_type} at {obj_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error creating fallback mesh: {e}")
        logger.error(traceback.format_exc())
        return False


def export_model(job_id: str, model_path: str, job: JobStatus) -> Tuple[bool, str]:
    """
    Enhanced model export with optimized mesh simplification and adaptive resolution
    
    Args:
        job_id: ID of the processing job
        model_path: Path to the NeRF model
        job: JobStatus object for progress tracking
        
    Returns:
        Tuple of (success, obj_path or error_message)
    """
    job.start_stage("export_model", "Exporting 3D model...")
    job.update("processing", "Generating 3D mesh from volume...", 82)
    
    output_dir = os.path.join(OUTPUT_PATH, job_id)
    obj_path = os.path.join(output_dir, "model.obj")
    
    # Determine best export parameters based on processing options
    mesh_resolution = 128  # Default resolution
    mesh_simplify = True  # Apply mesh simplification by default
    
    if job.processing_options.get("high_quality", False):
        mesh_resolution = 256  # Higher resolution for quality mode
    
    if job.processing_options.get("prioritize_speed", True):
        mesh_resolution = 96  # Lower resolution for speed
    
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
                cmd.extend(["--marching_cubes_res", str(mesh_resolution)])
            
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
            check=True,
            timeout=600  # 10 minutes timeout
        )
        
        logger.debug(f"Model export stdout: {result.stdout}")
        logger.debug(f"Model export stderr: {result.stderr}")
        
        if os.path.exists(obj_path):
            # Apply mesh post-processing if needed
            if mesh_simplify and o3d:
                job.update("processing", "Optimizing 3D mesh...", 88)
                success = simplify_mesh(obj_path, obj_path, target_reduction=0.5)
                if not success:
                    job.add_warning("Mesh simplification failed, using original mesh")
            
            job.end_stage("export_model", True)
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
                
                job.end_stage("export_model", True)
                return True, obj_path
            else:
                # Create fallback mesh
                roof_type = job.processing_options.get("roof_type_hint", "unknown")
                if create_fallback_mesh(obj_path, roof_type):
                    job.add_warning("Mesh export failed, using simplified mesh model")
                    job.end_stage("export_model", True)
                    return True, obj_path
                else:
                    job.end_stage("export_model", False)
                    return False, "Failed to export model to OBJ format"
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Model export error: {e}")
        logger.error(f"stdout: {e.stdout}")
        logger.error(f"stderr: {e.stderr}")
        
        # Create fallback mesh
        roof_type = job.processing_options.get("roof_type_hint", "unknown")
        if create_fallback_mesh(obj_path, roof_type):
            job.add_warning("Mesh export failed, using simplified mesh model")
            job.end_stage("export_model", True)
            return True, obj_path
        else:
            job.end_stage("export_model", False)
            return False, f"Error exporting model: {e}"
    
    except Exception as e:
        logger.error(f"Unexpected error in export_model: {e}")
        logger.error(traceback.format_exc())
        
        # Create fallback mesh
        roof_type = job.processing_options.get("roof_type_hint", "unknown")
        if create_fallback_mesh(obj_path, roof_type):
            job.add_warning("Mesh export failed, using simplified mesh model")
            job.end_stage("export_model", True)
            return True, obj_path
        else:
            job.end_stage("export_model", False)
            return False, f"Unexpected error: {e}"


def simplify_mesh(input_path, output_path, target_reduction=0.5, quality=0.9):
    """
    Simplify a mesh while preserving its key features
    
    Args:
        input_path: Path to input mesh file
        output_path: Path to output mesh file
        target_reduction: Target percentage to reduce (0-1)
        quality: Quality factor for simplification (0-1)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        if not o3d:
            logger.warning("Open3D not available, skipping mesh simplification")
            return False
        
        # Load mesh
        mesh = o3d.io.read_triangle_mesh(input_path)
        
        if not mesh.has_triangles():
            logger.warning("Mesh has no triangles, skipping simplification")
            return False
        
        # Get original triangle count
        original_triangles = len(mesh.triangles)
        target_triangles = int(original_triangles * (1 - target_reduction))
        
        if target_triangles < 100:
            logger.warning(f"Target triangle count too low ({target_triangles}), skipping simplification")
            return False
            
        logger.info(f"Simplifying mesh from {original_triangles} to {target_triangles} triangles")
        
        # Simplify mesh - keep vertices at boundary and use quadrics for better quality
        mesh_simplified = mesh.simplify_quadric_decimation(target_triangles)
        
        # Compute normals for better appearance
        mesh_simplified.compute_vertex_normals()
        
        # Save simplified mesh
        o3d.io.write_triangle_mesh(output_path, mesh_simplified)
        
        # Check result
        new_triangles = len(mesh_simplified.triangles)
        reduction_achieved = 1 - (new_triangles / original_triangles)
        
        logger.info(f"Mesh simplified to {new_triangles} triangles ({reduction_achieved:.2f} reduction)")
        
        return True
    except Exception as e:
        logger.error(f"Error simplifying mesh: {e}")
        return False


def calculate_roof_measurements(model_path: str, job: Optional[JobStatus] = None) -> Dict[str, Any]:
    """
    Enhanced roof measurement calculation with plane segmentation and structural analysis
    
    Args:
        model_path: Path to 3D model file
        job: JobStatus object for progress tracking (optional)
        
    Returns:
        Dictionary with roof measurements
    """
    if job:
        job.start_stage("calculate_measurements", "Calculating roof measurements...")
        job.update("processing", "Analyzing 3D model for measurements...", 90)
    
    try:
        # Try to use trimesh for measurements if available
        if trimesh:
            # Load the mesh
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
            
            # Try to identify roof planes
            roof_planes = []
            try:
                # Perform plane segmentation
                facet_centroids = mesh.triangles_center
                facet_normals = mesh.face_normals
                facet_areas = mesh.area_faces
                
                # Cluster faces by normal direction
                from sklearn.cluster import DBSCAN
                
                # Prepare normals for clustering
                # We only care
