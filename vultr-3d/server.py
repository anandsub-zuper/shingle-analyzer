#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import uuid
import subprocess
import shutil
from pathlib import Path
from werkzeug.utils import secure_filename
import process_roof_images

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = Path('uploads')
UPLOAD_FOLDER.mkdir(exist_ok=True)

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': 'online',
        'service': 'NeRF Roof Processing API',
        'version': '1.0.0'
    })

@app.route('/api/process', methods=['POST'])
def process_images():
    if 'images' not in request.files:
        return jsonify({'error': 'No images provided'}), 400
    
    files = request.files.getlist('images')
    if len(files) < 3:
        return jsonify({'error': 'At least 3 images are required'}), 400
    
    # Create a unique job ID
    job_id = str(uuid.uuid4())
    upload_dir = UPLOAD_FOLDER / job_id
    upload_dir.mkdir(exist_ok=True)
    
    # Save uploaded images
    for file in files:
        if file.filename:
            filename = secure_filename(file.filename)
            file.save(upload_dir / filename)
    
    # Start processing in background
    # In a production environment, you'd use Celery or similar
    # For simplicity, we'll use subprocess
    cmd = [
        "python3", "process_roof_images.py",
        "--input", str(upload_dir),
        "--name", job_id
    ]
    subprocess.Popen(cmd)
    
    return jsonify({
        'status': 'processing',
        'jobId': job_id,
        'message': 'Processing started'
    })

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    output_dir = Path("processed_models") / job_id
    if not output_dir.exists():
        return jsonify({
            'status': 'processing',
            'message': 'Job is still processing'
        })
    
    # Check if training is complete
    if (output_dir / "nerfstudio_models").exists():
        return jsonify({
            'status': 'complete',
            'message': 'Model training complete',
            'modelUrl': f'/api/model/{job_id}'
        })
    
    return jsonify({
        'status': 'processing',
        'message': 'Job is still processing'
    })

@app.route('/api/model/<job_id>', methods=['GET'])
def get_model(job_id):
    # For a real implementation, you'd export the model in a web-friendly format
    # For now, we'll just return the config file to confirm it exists
    model_dir = Path("processed_models") / job_id / "nerfstudio_models"
    if not model_dir.exists():
        return jsonify({'error': 'Model not found'}), 404
    
    config_file = next(model_dir.glob("*.json"), None)
    if not config_file:
        return jsonify({'error': 'Model config not found'}), 404
    
    return send_file(config_file)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
