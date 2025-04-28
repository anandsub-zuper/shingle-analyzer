// src/components/ThreeDRoofAnalyzer.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import CostEstimation from './CostEstimation';
import RoofCaptureGuide from './RoofCaptureGuide';
import '../styles/ThreeDRoofAnalyzer.css';

const ThreeDRoofAnalyzer = () => {
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [measurements, setMeasurements] = useState(null);
  const [damageData, setDamageData] = useState(null);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const navigate = useParams();
  
  // Handle file upload
  const handleImageUpload = async (event) => {
    const files = event.target.files;
    
    if (files.length < 3) {
      alert('Please select at least 3 images for accurate 3D reconstruction');
      return;
    }
    
    setImages(Array.from(files));
    
    // Preview images
    const imagePreviews = Array.from(files).map(file => URL.createObjectURL(file));
    setImagePreviews(imagePreviews);
  };
  
  // Start processing images
  const processImages = async () => {
    if (images.length < 3) {
      alert('Please select at least 3 images for accurate 3D reconstruction');
      return;
    }
    
    setUploading(true);
    setJobStatus('uploading');
    setStatusMessage('Uploading images...');
    
    try {
      const formData = new FormData();
      images.forEach(image => {
        formData.append('images', image);
      });
      
      const response = await fetch('http://66.135.21.204:5000/api/process', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.jobId) {
        setJobId(data.jobId);
        setJobStatus('processing');
        setStatusMessage(data.message || 'Processing started');
        
        // Start polling for job status
        pollJobStatus(data.jobId);
      } else {
        setJobStatus('error');
        setStatusMessage(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error processing images:', error);
      setJobStatus('error');
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Poll job status until complete or error
  const pollJobStatus = async (jobId) => {
    try {
      const response = await fetch(`http://66.135.21.204:5000/api/job/${jobId}`);
      const data = await response.json();
      
      setJobStatus(data.status);
      setStatusMessage(data.message || '');
      setProgress(data.progress || 0);
      
      if (data.status === 'complete') {
        // Load model and measurements
        if (data.measurements) {
          setMeasurements(data.measurements);
          
          // Convert measurements to damage data format for cost estimation
          const damageData = {
            overallCondition: 'Good', // Default
            severity: 5, // Default
            damageTypes: [],
            description: 'Based on 3D model analysis',
            recommendedAction: 'Inspection recommended to assess any damage not visible in the model'
          };
          
          setDamageData(damageData);
          
          // Load 3D model
          loadModel(data.modelUrl || `http://66.135.21.204:5000/api/model/${jobId}`);
        }
      } else if (data.status === 'error') {
        console.error('Job processing failed:', data.message);
      } else {
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 5000);
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      setStatusMessage(`Error checking status: ${error.message}`);
      
      // Continue polling despite error
      setTimeout(() => pollJobStatus(jobId), 10000);
    }
  };
  
  // Load and display 3D model
  const loadModel = async (modelUrl) => {
    if (!containerRef.current) return;
    
    // Initialize Three.js scene
    const width = containerRef.current.clientWidth;
    const height = 500;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    
    // Clear previous content
    if (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    
    containerRef.current.appendChild(renderer.domElement);
    
    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Try to load the model
    try {
      // Determine loader based on file extension
      if (modelUrl.endsWith('.obj')) {
        const loader = new OBJLoader();
        loader.load(modelUrl, (object) => {
          centerAndScaleModel(object, scene);
          
          // Add material if not present
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (!child.material) {
                child.material = new THREE.MeshStandardMaterial({ 
                  color: 0x777777,
                  roughness: 0.7,
                  metalness: 0.2
                });
              }
            }
          });
        });
      } else if (modelUrl.endsWith('.glb') || modelUrl.endsWith('.gltf')) {
        const loader = new GLTFLoader();
        loader.load(modelUrl, (gltf) => {
          centerAndScaleModel(gltf.scene, scene);
        });
      } else {
        // For API endpoint that returns model data
        const response = await fetch(modelUrl);
        const data = await response.json();
        
        if (data.modelUrl) {
          loadModel(data.modelUrl);
          return;
        } else {
          console.error('Model URL not found in response');
          setStatusMessage('Could not load 3D model');
        }
      }
    } catch (error) {
      console.error('Error loading model:', error);
      setStatusMessage(`Error loading 3D model: ${error.message}`);
    }
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = 500;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Save reference to scene for cleanup
    sceneRef.current = { scene, renderer, controls };
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (sceneRef.current) {
        if (sceneRef.current.controls) {
          sceneRef.current.controls.dispose();
        }
        
        if (sceneRef.current.renderer) {
          sceneRef.current.renderer.dispose();
        }
      }
    };
  };
  
  // Helper to center and scale the loaded model
  const centerAndScaleModel = (object, scene) => {
    // Add to scene
    scene.add(object);
    
    // Center the model
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Get largest dimension for scaling
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 10 / maxDim;
    
    object.position.x = -center.x;
    object.position.y = -center.y;
    object.position.z = -center.z;
    
    // Scale the object
    object.scale.set(scale, scale, scale);
    
    // Adjust camera and controls
    if (sceneRef.current && sceneRef.current.controls) {
      sceneRef.current.controls.target.set(0, 0, 0);
      sceneRef.current.controls.update();
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sceneRef.current && sceneRef.current.renderer) {
        if (containerRef.current && containerRef.current.contains(sceneRef.current.renderer.domElement)) {
          containerRef.current.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current.renderer.dispose();
      }
    };
  }, []);
  
  return (
    <div className="threed-roof-analyzer">
      <h2 className="section-title">3D Roof Analyzer</h2>
      
      {/* Show capture guide when no job is in progress */}
      {jobStatus === 'idle' && (
        <>
          <RoofCaptureGuide />
          
          <div className="upload-section">
            <div className="form-group">
              <label className="input-label">Upload Roof Images (minimum 3)</label>
              <div className="file-input-wrapper">
                <div className="file-input-icon upload-icon"></div>
                <div className="file-input-text">Drag & drop your images here or click to browse</div>
                <div className="file-input-description">Upload 8-15 photos from different angles for best results</div>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleImageUpload}
                  className="file-input"
                  multiple
                />
              </div>
            </div>
            
            {images.length > 0 && (
              <div className="selected-images">
                <p>{images.length} images selected</p>
                <button 
                  className="process-button"
                  onClick={processImages}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Generate 3D Model'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Show progress when processing */}
      {(jobStatus === 'uploading' || jobStatus === 'processing') && (
        <div className="processing-status">
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="status-message">{statusMessage}</p>
          <p className="status-description">
            {progress < 30 && 'Analyzing camera positions...'}
            {progress >= 30 && progress < 70 && 'Building 3D model...'}
            {progress >= 70 && progress < 90 && 'Calculating measurements...'}
            {progress >= 90 && 'Finalizing results...'}
          </p>
          <p className="wait-message">This process may take 5-10 minutes depending on the number and quality of images.</p>
        </div>
      )}
      
      {/* Show error if processing failed */}
      {jobStatus === 'error' && (
        <div className="processing-error">
          <div className="error-icon">⚠️</div>
          <h3>Processing Error</h3>
          <p>{statusMessage}</p>
          <button 
            className="retry-button"
            onClick={() => setJobStatus('idle')}
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Show results when complete */}
      {jobStatus === 'complete' && (
        <div className="results-container">
          <div className="model-container">
            <h3 className="section-subtitle">3D Roof Model</h3>
            <div ref={containerRef} className="model-viewer"></div>
            <p className="model-instructions">
              Use mouse to rotate | Scroll to zoom | Right-click to pan
            </p>
          </div>
          
          {measurements && (
            <div className="measurements-container">
              <h3 className="section-subtitle">Roof Measurements</h3>
              
              <div className="measurements-grid">
                <div className="measurement-item">
                  <span className="measurement-label">Total Area</span>
                  <span className="measurement-value">
                    {measurements.area.total.toLocaleString()} {measurements.area.unit === 'sq_ft' ? 'sq ft' : measurements.area.unit}
                  </span>
                </div>
                
                <div className="measurement-item">
                  <span className="measurement-label">Roof Pitch</span>
                  <span className="measurement-value">
                    {measurements.pitch.primary} ({measurements.pitch.degrees}°)
                  </span>
                </div>
                
                <div className="measurement-item">
                  <span className="measurement-label">Dimensions</span>
                  <span className="measurement-value">
                    {measurements.dimensions.length}' × {measurements.dimensions.width}' × {measurements.dimensions.height}'
                  </span>
                </div>
                
                <div className="measurement-item">
                  <span className="measurement-label">Detected Features</span>
                  <span className="measurement-value">
                    {measurements.features.chimneys > 0 && `${measurements.features.chimneys} chimney${measurements.features.chimneys > 1 ? 's' : ''}, `}
                    {measurements.features.vents > 0 && `${measurements.features.vents} vent${measurements.features.vents > 1 ? 's' : ''}, `}
                    {measurements.features.skylights > 0 && `${measurements.features.skylights} skylight${measurements.features.skylights > 1 ? 's' : ''}`}
                    {measurements.features.chimneys === 0 && measurements.features.vents === 0 && measurements.features.skylights === 0 && 'None detected'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {damageData && (
            <div className="damage-estimation">
              <CostEstimation damageData={damageData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThreeDRoofAnalyzer;
