from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import subprocess
import logging
import json
import time
import shutil
import numpy as np
import struct
import collections
from datetime import datetime
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - **%(name)s** - %(levelname)s - %(message)s'
)
logger = logging.getLogger("__main__")

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
RESULTS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}
MAX_IMAGES = 50

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# In-memory database to track job status
jobs = {}

# COLMAP to NeRF Conversion Utilities
def read_next_bytes(fid, num_bytes, format_char_sequence, endian_character="<"):
    """Read and unpack the next bytes from a binary file."""
    data = fid.read(num_bytes)
    return struct.unpack(endian_character + format_char_sequence, data)

def read_cameras_binary(path_to_model_file):
    """Read camera parameters from binary file."""
    cameras = {}
    Camera = collections.namedtuple(
        "Camera", ["id", "model", "width", "height", "params"]
    )
    with open(path_to_model_file, "rb") as fid:
        num_cameras = read_next_bytes(fid, 8, "Q")[0]
        for _ in range(num_cameras):
            camera_properties = read_next_bytes(
                fid, 24, "iiQQ")
            camera_id = camera_properties[0]
            model_id = camera_properties[1]
            width = camera_properties[2]
            height = camera_properties[3]
            num_params = 4
            if model_id == 2:  # PINHOLE
                num_params = 4
            elif model_id == 3:  # RADIAL
                num_params = 5
            elif model_id == 4:  # OPENCV
                num_params = 8
            elif model_id == 5:  # OPENCV_FISHEYE
                num_params = 8
            elif model_id == 6:  # FULL_OPENCV
                num_params = 12
            elif model_id == 7:  # FOV
                num_params = 5
            elif model_id == 8:  # SIMPLE_RADIAL_FISHEYE
                num_params = 5
            elif model_id == 9:  # RADIAL_FISHEYE
                num_params = 8
            elif model_id == 10:  # THIN_PRISM_FISHEYE
                num_params = 12
            params = read_next_bytes(fid, 8 * num_params, "d" * num_params)
            cameras[camera_id] = Camera(
                id=camera_id, model=model_id, width=width, height=height, params=params
            )
        assert len(cameras) == num_cameras
    return cameras

def read_images_binary(path_to_model_file):
    """Read camera positions from binary file."""
    images = {}
    Image = collections.namedtuple(
        "Image", ["id", "qvec", "tvec", "camera_id", "name", "xys", "point3D_ids"]
    )
    with open(path_to_model_file, "rb") as fid:
        num_images = read_next_bytes(fid, 8, "Q")[0]
        for _ in range(num_images):
            binary_image_properties = read_next_bytes(
                fid, 64, "idddddddi")
            image_id = binary_image_properties[0]
            qvec = binary_image_properties[1:5]
            tvec = binary_image_properties[5:8]
            camera_id = binary_image_properties[8]

            image_name = ""
            current_char = read_next_bytes(fid, 1, "c")[0]
            while current_char != b"\x00":
                image_name += current_char.decode("utf-8")
                current_char = read_next_bytes(fid, 1, "c")[0]

            num_points2D = read_next_bytes(fid, 8, "Q")[0]
            x_y_id_s = read_next_bytes(fid, 24 * num_points2D, "ddq" * num_points2D)
            xys = []
            point3D_ids = []
            for i in range(num_points2D):
                xys.append((float(x_y_id_s[3 * i]), float(x_y_id_s[3 * i + 1])))
                point3D_ids.append(x_y_id_s[3 * i + 2])
            
            images[image_id] = Image(
                id=image_id, qvec=qvec, tvec=tvec, camera_id=camera_id, name=image_name,
                xys=xys, point3D_ids=point3D_ids
            )
    return images

def qvec2rotmat(qvec):
    return np.array([
        [1 - 2 * qvec[2]**2 - 2 * qvec[3]**2, 2 * qvec[1] * qvec[2] - 2 * qvec[0] * qvec[3], 2 * qvec[3] * qvec[1] + 2 * qvec[0] * qvec[2]],
        [2 * qvec[1] * qvec[2] + 2 * qvec[0] * qvec[3], 1 - 2 * qvec[1]**2 - 2 * qvec[3]**2, 2 * qvec[2] * qvec[3] - 2 * qvec[0] * qvec[1]],
        [2 * qvec[3] * qvec[1] - 2 * qvec[0] * qvec[2], 2 * qvec[2] * qvec[3] + 2 * qvec[0] * qvec[1], 1 - 2 * qvec[1]**2 - 2 * qvec[2]**2]])

def find_image_files(image_dir):
    """Find all image files in the directory."""
    image_files = []
    for file in os.listdir(image_dir):
        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
            image_files.append(file)
    return image_files

def convert_colmap_to_transforms(colmap_dir, image_dir, output_path):
    """Convert COLMAP binary output to transforms.json format for NeRF."""
    # Read COLMAP binary files
    cameras_path = os.path.join(colmap_dir, 'cameras.bin')
    images_path = os.path.join(colmap_dir, 'images.bin')
    
    if not os.path.exists(cameras_path) or not os.path.exists(images_path):
        print("Error: cameras.bin or images.bin not found")
        return False
    
    cameras = read_cameras_binary(cameras_path)
    images = read_images_binary(images_path)
    
    print(f"Found {len(cameras)} cameras and {len(images)} images")
    
    # Find all image files in the directory
    all_image_files = find_image_files(image_dir)
    print(f"Found {len(all_image_files)} image files in directory")
    
    frames = []
    for image_id, image_info in images.items():
        # Get camera info
        camera_id = image_info.camera_id
        camera = cameras[camera_id]
        
        # Convert quaternion to rotation matrix
        qvec = image_info.qvec
        R = qvec2rotmat(qvec)
        
        # Convert COLMAP's camera coordinate system to NeRF
        R = np.array([[1, 0, 0], [0, -1, 0], [0, 0, -1]]) @ R
        t = -R @ np.array(image_info.tvec)
        
        # Calculate camera-to-world transform matrix
        transform_matrix = np.eye(4)
        transform_matrix[:3, :3] = R
        transform_matrix[:3, 3] = t
        
        # Get image name
        image_name = image_info.name
        
        # Get focal length
        focal_x = camera.params[0]
        focal_y = focal_x  # Default to square pixels
        
        # Get principal point
        cx = camera.width / 2
        cy = camera.height / 2
        
        if camera.model == 2:  # PINHOLE
            if len(camera.params) >= 4:
                focal_y = camera.params[1]
                cx = camera.params[2]
                cy = camera.params[3]
                
        if camera.model == 3:  # RADIAL
            if len(camera.params) >= 4:
                cx = camera.params[1]
                cy = camera.params[2]
        
        # Ensure all required fields are included
        frame = {
            "file_path": image_name,
            "transform_matrix": transform_matrix.tolist(),
            "w": int(camera.width),  # Add w field
            "h": int(camera.height),  # Add h field
            "width": int(camera.width),  # Add width field
            "height": int(camera.height),  # Add height field
            "fl_x": float(focal_x),
            "fl_y": float(focal_y),
            "cx": float(cx),
            "cy": float(cy),
            "k1": 0.0,  # Add distortion parameters
            "k2": 0.0,
            "p1": 0.0,
            "p2": 0.0
        }
        frames.append(frame)
    
    # Sort frames by filename
    frames.sort(key=lambda f: f["file_path"])
    
    # Calculate camera_angle_x
    camera_angle_x = 0.8575560450553894  # Default placeholder
    
    if len(frames) > 0:
        first_camera = frames[0]
        focal_length = first_camera["fl_x"]
        width = first_camera["width"]
        camera_angle_x = 2 * np.arctan(width / (2 * focal_length))
    
    # Create transforms.json
    transforms = {
        "camera_angle_x": float(camera_angle_x),
        "frames": frames
    }
    
    # Save transforms.json
    try:
        with open(output_path, 'w') as f:
            json.dump(transforms, f, indent=4)
        print(f"Successfully wrote transforms.json with {len(frames)} frames to {output_path}")
        return True
    except Exception as e:
        print(f"Error writing transforms.json: {str(e)}")
        return False

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def update_job_status(job_id, status, progress=0, message=""):
    """Update job status and log it"""
    timestamp = datetime.now().isoformat()
    jobs[job_id] = {
        "id": job_id,
        "status": status,
        "progress": progress,
        "message": message,
        "createdAt": jobs.get(job_id, {}).get("createdAt", timestamp),
        "updatedAt": timestamp,
        "imageCount": jobs.get(job_id, {}).get("imageCount", 0)
    }
    logger.info(f"Job {job_id} status updated: {status}, {progress}%, {message}")

def run_colmap_pipeline(job_id, job_dir, image_dir):
    """Run the COLMAP pipeline using CPU-only mode for maximum compatibility"""
    try:
        # Set environment variables to force offscreen rendering
        my_env = os.environ.copy()
        my_env["QT_QPA_PLATFORM"] = "offscreen"
        my_env["DISPLAY"] = ""
        
        # Create COLMAP workspace
        colmap_dir = os.path.join(job_dir, "colmap")
        os.makedirs(colmap_dir, exist_ok=True)
        
        # Directory for sparse reconstruction
        sparse_dir = os.path.join(colmap_dir, "sparse")
        os.makedirs(sparse_dir, exist_ok=True)
        
        # Database path
        db_path = os.path.join(colmap_dir, "database.db")
        
        # Step 1: Feature extraction - using CPU
        update_job_status(job_id, "processing", 15, "Running feature extraction (CPU)...")
        logger.info(f"Starting CPU-based feature extraction for job {job_id}")
        
        feature_cmd = [
            "colmap", "feature_extractor",
            "--database_path", db_path,
            "--image_path", image_dir,
            "--SiftExtraction.use_gpu", "0",  # Force CPU extraction
            "--SiftExtraction.max_num_features", "8192",  # Extract more features
            "--SiftExtraction.first_octave", "-1",  # Start at full resolution
            "--SiftExtraction.num_octaves", "4",  # Use more octaves for better matching
            "--SiftExtraction.peak_threshold", "0.004"  # Lower threshold to get more features
        ]
        
        logger.info(f"Running command: {' '.join(feature_cmd)}")
        feature_process = subprocess.run(
            feature_cmd, 
            env=my_env, 
            check=True,
            capture_output=True,
            text=True
        )
        
        logger.info(f"Feature extraction stdout: {feature_process.stdout}")
        if feature_process.stderr:
            logger.warning(f"Feature extraction stderr: {feature_process.stderr}")
        
        # Step 2: Match features - using CPU
        update_job_status(job_id, "processing", 40, "Matching features (CPU)...")
        logger.info(f"Starting CPU-based feature matching for job {job_id}")
        
        match_cmd = [
            "colmap", "exhaustive_matcher",
            "--database_path", db_path,
            "--SiftMatching.use_gpu", "0",  # Force CPU matching
            "--SiftMatching.max_ratio", "0.9",  # More permissive ratio test (default is 0.8)
            "--SiftMatching.max_distance", "0.7",  # More permissive distance threshold
            "--SiftMatching.cross_check", "1"  # Enable cross-checking for more reliable matches
        ]
        
        logger.info(f"Running command: {' '.join(match_cmd)}")
        match_process = subprocess.run(
            match_cmd, 
            env=my_env, 
            check=True,
            capture_output=True,
            text=True
        )
        
        logger.info(f"Feature matching stdout: {match_process.stdout}")
        if match_process.stderr:
            logger.warning(f"Feature matching stderr: {match_process.stderr}")
        
        # Check if there were matches
        if "WARNING: No images with matches found in the database" in match_process.stdout:
            # Try sequential matcher as fallback
            update_job_status(job_id, "processing", 45, "Trying sequential matcher...")
            logger.info(f"Using sequential matcher for job {job_id}")
            
            seq_match_cmd = [
                "colmap", "sequential_matcher",
                "--database_path", db_path,
                "--SiftMatching.use_gpu", "0",
                "--SequentialMatching.overlap", "10",
                "--SequentialMatching.quadratic_overlap", "1",
                "--SequentialMatching.loop_detection", "1",
                "--SequentialMatching.loop_detection_period", "10"
            ]
            
            logger.info(f"Running command: {' '.join(seq_match_cmd)}")
            seq_match_process = subprocess.run(
                seq_match_cmd, 
                env=my_env, 
                check=True,
                capture_output=True,
                text=True
            )
            
            logger.info(f"Sequential matching stdout: {seq_match_process.stdout}")
            if seq_match_process.stderr:
                logger.warning(f"Sequential matching stderr: {seq_match_process.stderr}")
                
            # Check if still no matches
            if "WARNING: No images with matches found in the database" in seq_match_process.stdout:
                raise Exception("Failed to find matches between images. The images may not have enough overlap or distinct features.")
        
        # Step 3: Sparse reconstruction (mapper)
        update_job_status(job_id, "processing", 60, "Building sparse reconstruction...")
        logger.info(f"Starting sparse reconstruction for job {job_id}")
        
        mapper_cmd = [
            "colmap", "mapper",
            "--database_path", db_path,
            "--image_path", image_dir,
            "--output_path", sparse_dir,
            "--Mapper.min_model_size", "3",  # Reduce minimum model size (default is 10)
            "--Mapper.init_min_num_inliers", "15",  # Reduce minimum inliers for initialization
            "--Mapper.abs_pose_min_num_inliers", "7",  # Lower threshold for adding images
            "--Mapper.abs_pose_min_inlier_ratio", "0.25",  # Lower ratio threshold
            "--Mapper.ba_global_max_num_iterations", "50",  # More bundle adjustment iterations
            "--Mapper.ba_global_max_refinements", "5",  # More refinement iterations
            "--Mapper.ba_local_max_num_iterations", "30",  # More local BA iterations
            "--Mapper.init_max_reg_trials", "5",  # Try more registration trials for initialization
            "--Mapper.min_focal_length_ratio", "0.1",  # More permissive focal length
            "--Mapper.max_focal_length_ratio", "10.0",  # More permissive focal length
            "--Mapper.max_extra_param", "1.0"  # More permissive distortion parameters
        ]
        
        logger.info(f"Running command: {' '.join(mapper_cmd)}")
        mapper_process = subprocess.run(
            mapper_cmd, 
            env=my_env, 
            check=True,
            capture_output=True,
            text=True
        )
        
        logger.info(f"Mapper stdout: {mapper_process.stdout}")
        if mapper_process.stderr:
            logger.warning(f"Mapper stderr: {mapper_process.stderr}")
        
        # Check if the sparse reconstruction was successful
        sparse_model_dir = os.path.join(sparse_dir, "0")
        if not os.path.exists(sparse_model_dir):
            raise Exception("Sparse reconstruction failed to produce valid output")
        
        # Step 4: Convert COLMAP model to NeRF format
        update_job_status(job_id, "processing", 70, "Converting camera parameters for NeRF...")
        logger.info(f"Converting COLMAP output to NeRF format for job {job_id}")
        
        transforms_json_path = os.path.join(job_dir, "transforms.json")
        success = convert_colmap_to_transforms(sparse_model_dir, image_dir, transforms_json_path)
        
        if not success:
            raise Exception("Failed to convert COLMAP output to NeRF format")
        
        # Create a copy of transforms.json in the images directory for Nerfstudio
        image_transforms_path = os.path.join(image_dir, "transforms.json")
        
        if os.path.exists(image_transforms_path):
            os.remove(image_transforms_path)
            
        shutil.copy(transforms_json_path, image_transforms_path)
        
        logger.info(f"Created transforms.json for job {job_id}")
        update_job_status(job_id, "processing", 80, "Camera positions estimated successfully")
        
        return True
    
    except subprocess.CalledProcessError as e:
        logger.error(f"COLMAP command failed for job {job_id}: {str(e)}")
        logger.error(f"STDOUT: {e.stdout if hasattr(e, 'stdout') else None}")
        logger.error(f"STDERR: {e.stderr if hasattr(e, 'stderr') else None}")
        update_job_status(job_id, "error", 0, f"Failed to estimate camera positions: {str(e)}")
        return False
    
    except Exception as e:
        logger.error(f"Error in processing job {job_id}: {str(e)}")
        update_job_status(job_id, "error", 0, f"Processing error: {str(e)}")
        return False

def train_nerf(job_id, job_dir, image_dir):
    """Train a NeRF model using Nerfstudio with GPU"""
    try:
        update_job_status(job_id, "processing", 85, "Training 3D model (NeRF)...")
        logger.info(f"Starting NeRF training for job {job_id}")
        
        # Create output directory for NeRF
        nerf_dir = os.path.join(job_dir, "nerf")
        os.makedirs(nerf_dir, exist_ok=True)
        
        # Check if transforms.json exists
        transforms_json_path = os.path.join(image_dir, "transforms.json")
        if not os.path.exists(transforms_json_path):
            raise Exception(f"transforms.json not found at {transforms_json_path}")
        
        # Set environment variables for GPU
        my_env = os.environ.copy()
        my_env["CUDA_VISIBLE_DEVICES"] = "0"
        
        # Run Nerfstudio training - this still uses GPU
        train_cmd = [
            "ns-train", "instant-ngp",
            "--data", image_dir,
            "--output-dir", nerf_dir,
            "--timestamp", job_id,
            "--max-num-iterations", "5000",
            "--pipeline.model.background-color", "white"
        ]
        
        logger.info(f"Running Nerfstudio command: {' '.join(train_cmd)}")
        
        train_process = subprocess.run(
            train_cmd,
            env=my_env,
            check=True,
            capture_output=True,
            text=True
        )
        
        logger.info(f"NeRF training stdout: {train_process.stdout}")
        if train_process.stderr:
            logger.warning(f"NeRF training stderr: {train_process.stderr}")
        
        update_job_status(job_id, "processing", 95, "NeRF training completed")
        
        # Generate output renders (future enhancement)
        
        update_job_status(job_id, "complete", 100, "Processing completed successfully")
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"NeRF training failed for job {job_id}: {str(e)}")
        logger.error(f"STDOUT: {e.stdout if hasattr(e, 'stdout') else None}")
        logger.error(f"STDERR: {e.stderr if hasattr(e, 'stderr') else None}")
        update_job_status(job_id, "error", 0, "Failed to train 3D model")
        return False
    
    except Exception as e:
        logger.error(f"Error in NeRF training for job {job_id}: {str(e)}")
        update_job_status(job_id, "error", 0, f"NeRF training error: {str(e)}")
        return False

def process_images(job_id):
    """Process uploaded images with COLMAP and NeRF"""
    try:
        # Create job directory structure
        job_dir = os.path.join(RESULTS_FOLDER, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        image_dir = os.path.join(UPLOAD_FOLDER, job_id)
        
        update_job_status(job_id, "processing", 5, "Starting image processing...")
        
        # Run COLMAP to estimate camera positions with optimized parameters
        logger.info(f"Starting COLMAP for job {job_id}")
        update_job_status(job_id, "processing", 10, "Running COLMAP for camera position estimation...")
        
        colmap_success = run_colmap_pipeline(job_id, job_dir, image_dir)
        
        if not colmap_success:
            return
        
        # Run NeRF training
        nerf_success = train_nerf(job_id, job_dir, image_dir)
        
        if not nerf_success:
            return
        
        # If we reach here, everything was successful
        update_job_status(job_id, "complete", 100, "Processing completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing job {job_id}: {str(e)}")
        update_job_status(job_id, "error", 0, f"Processing error: {str(e)}")

@app.route('/api/status', methods=['GET'])
def get_api_status():
    return jsonify({
        "service": "NeRF Roof Processing API",
        "status": "online",
        "version": "1.0.0"
    })

@app.route('/api/process', methods=['POST'])
def process_roof_images():
    """Handle image uploads and start processing"""
    logger.info("Received upload request")
    
    # Check if files are in the request
    if 'images' not in request.files:
        return jsonify({"error": "No images found in request"}), 400
    
    files = request.files.getlist('images')
    if len(files) == 0:
        return jsonify({"error": "No selected files"}), 400
    
    if len(files) > MAX_IMAGES:
        return jsonify({"error": f"Too many images. Maximum allowed: {MAX_IMAGES}"}), 400
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Create directory for this job
    job_upload_dir = os.path.join(UPLOAD_FOLDER, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    
    # Save uploaded files
    saved_files = []
    for file in files:
        if file and allowed_file(file.filename):
            safe_filename = str(uuid.uuid4()) + "." + file.filename.rsplit('.', 1)[1].lower()
            file_path = os.path.join(job_upload_dir, safe_filename)
            file.save(file_path)
            saved_files.append(file_path)
    
    logger.info(f"Received {len(saved_files)} files")
    
    # Initialize job in our database
    update_job_status(job_id, "queued", 0, "Job received and queued for processing")
    jobs[job_id]["imageCount"] = len(saved_files)
    
    # Start processing in a separate thread
    thread = threading.Thread(target=process_images, args=(job_id,))
    thread.daemon = True
    thread.start()
    
    # Return job ID to client
    return jsonify({
        "jobId": job_id,
        "status": "queued",
        "message": "Images received and queued for processing"
    })

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Check status of a job"""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404
    
    return jsonify(jobs[job_id])

@app.route('/api/model/<job_id>', methods=['GET'])
def get_model(job_id):
    """Retrieve the processed 3D model for a job"""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404
    
    if jobs[job_id]["status"] != "complete":
        return jsonify({"error": "Model not ready yet"}), 400
    
    # In a real implementation, this would serve the actual 3D model file
    # For this example, we'll return a mock response
    return jsonify({
        "jobId": job_id,
        "modelUrl": f"/api/files/{job_id}/model.glb"
    })

@app.route('/api/files/<job_id>/<filename>', methods=['GET'])
def get_job_file(job_id, filename):
    """Serve files from the job results directory"""
    job_dir = os.path.join(RESULTS_FOLDER, job_id)
    
    if not os.path.exists(job_dir):
        return jsonify({"error": "Job not found"}), 404
    
    return send_from_directory(job_dir, filename)

# Main route
@app.route('/', methods=['GET'])
def index():
    return "NeRF Roof Processing API - Use /api/process to upload images"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=False)
