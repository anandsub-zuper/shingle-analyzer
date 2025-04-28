// src/components/Roof3DViewer.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import '../styles/Roof3DViewer.css';

const Roof3DViewer = ({ modelUrl, damageData, onMeasurementUpdate }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const roofModelRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [measuringMode, setMeasuringMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState({
    distances: [],
    areas: [],
    totalDamageArea: 0,
    totalRoofArea: 0,
    damagePercentage: 0
  });
  
  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    sceneRef.current = scene;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Camera
    const camera = new THREE.PerspectiveCamera(
      45, 
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 8, 15);
    cameraRef.current = camera;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    scene.add(gridHelper);
    
    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
      controls.dispose();
      
      // Clean up any loaded models
      if (roofModelRef.current) {
        scene.remove(roofModelRef.current);
        roofModelRef.current = null;
      }
    };
  }, []);
  
  // Load 3D model
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;
    
    setLoading(true);
    
    // Clear previous model if it exists
    if (roofModelRef.current) {
      sceneRef.current.remove(roofModelRef.current);
      roofModelRef.current = null;
    }
    
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        
        // Calculate roof area for the loaded model
        const roofArea = calculateRoofArea(model);
        
        // Apply material to show damage if available
        if (damageData) {
          applyDamageMaterials(model, damageData);
        }
        
        // Center and scale the model
        centerModel(model);
        
        // Add model to scene
        sceneRef.current.add(model);
        roofModelRef.current = model;
        
        // Update measurements with area calculation
        setMeasurements(prev => ({
          ...prev,
          totalRoofArea: roofArea
        }));
        
        setLoading(false);
      },
      (xhr) => {
        // Loading progress
        console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error('Error loading model:', error);
        setLoading(false);
      }
    );
  }, [modelUrl, damageData]);
  
  // Update parent component when measurements change
  useEffect(() => {
    if (onMeasurementUpdate) {
      onMeasurementUpdate(measurements);
    }
  }, [measurements, onMeasurementUpdate]);
  
  // Center the loaded model
  const centerModel = (model) => {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    // Scale model to reasonable size if needed
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 10) {
      const scale = 10 / maxDim;
      model.scale.set(scale, scale, scale);
    }
  };
  
  // Calculate roof area from 3D model
  const calculateRoofArea = (model) => {
    let totalArea = 0;
    
    model.traverse((child) => {
      if (child.isMesh) {
        const geometry = child.geometry;
        if (geometry) {
          // Get position attribute
          const positionAttr = geometry.getAttribute('position');
          if (positionAttr && geometry.index) {
            const indices = geometry.index.array;
            
            // Calculate area of each triangle face
            for (let i = 0; i < indices.length; i += 3) {
              const a = new THREE.Vector3().fromBufferAttribute(
                positionAttr, indices[i]
              );
              const b = new THREE.Vector3().fromBufferAttribute(
                positionAttr, indices[i + 1]
              );
              const c = new THREE.Vector3().fromBufferAttribute(
                positionAttr, indices[i + 2]
              );
              
              // Get two edges of the triangle
              const edge1 = new THREE.Vector3().subVectors(b, a);
              const edge2 = new THREE.Vector3().subVectors(c, a);
              
              // Area = 0.5 * |edge1 × edge2|
              const area = 0.5 * new THREE.Vector3()
                .crossVectors(edge1, edge2)
                .length();
                
              totalArea += area;
            }
          }
        }
      }
    });
    
    // Convert to square feet if the model is in meters
    const areaInSqFeet = totalArea * 10.764;
    return Math.round(areaInSqFeet);
  };
  
  // Apply materials to highlight damaged areas
  const applyDamageMaterials = (model, damageData) => {
    if (!damageData || !damageData.damageTypes || damageData.damageTypes.length === 0) return;
    
    // Create materials for different damage types
    const damageMaterials = {
      'missing shingles': new THREE.MeshStandardMaterial({ color: 0xff0000, opacity: 0.7, transparent: true }),
      'water damage': new THREE.MeshStandardMaterial({ color: 0x0000ff, opacity: 0.7, transparent: true }),
      'hail damage': new THREE.MeshStandardMaterial({ color: 0xffff00, opacity: 0.7, transparent: true }),
      'default': new THREE.MeshStandardMaterial({ color: 0xff9900, opacity: 0.7, transparent: true })
    };
    
    // Simulate damage areas (in a real app, this would come from actual detection)
    model.traverse((child) => {
      if (child.isMesh) {
        // Clone original material for later use
        child.userData.originalMaterial = child.material.clone();
        
        // For demo purposes, we'll randomly apply damage to some meshes
        if (Math.random() > 0.7) {
          const damageType = damageData.damageTypes[
            Math.floor(Math.random() * damageData.damageTypes.length)
          ];
          
          const material = damageMaterials[damageType.toLowerCase()] || damageMaterials.default;
          child.material = material;
          
          // Mark as damaged for measurement calculations
          child.userData.isDamaged = true;
          child.userData.damageType = damageType;
          
          // Calculate damaged area
          const geometry = child.geometry;
          if (geometry) {
            let faceArea = 0;
            // [Simplified area calculation for damaged faces]
            // In a real implementation, this would be more precise
            
            // Update damage area measurements
            setMeasurements(prev => {
              const updatedAreas = [...prev.areas];
              const existingIndex = updatedAreas.findIndex(a => a.type === damageType);
              
              if (existingIndex >= 0) {
                updatedAreas[existingIndex].area += faceArea;
              } else {
                updatedAreas.push({ type: damageType, area: faceArea });
              }
              
              const totalDamageArea = updatedAreas.reduce((sum, item) => sum + item.area, 0);
              const damagePercentage = prev.totalRoofArea ? 
                (totalDamageArea / prev.totalRoofArea * 100).toFixed(1) : 0;
              
              return {
                ...prev,
                areas: updatedAreas,
                totalDamageArea,
                damagePercentage
              };
            });
          }
        }
      }
    });
  };
  
  // Handle click on the 3D model for measurements
  const handleModelClick = (event) => {
    if (!measuringMode || !roofModelRef.current) return;
    
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, cameraRef.current);
    
    const intersects = raycaster.intersectObject(roofModelRef.current, true);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      // Add marker at clicked point
      const marker = createMarker(point);
      sceneRef.current.add(marker);
      
      // Add to measure points
      const updatedPoints = [...measurePoints, { point, marker }];
      setMeasurePoints(updatedPoints);
      
      // If we have two points, calculate distance
      if (updatedPoints.length === 2) {
        const distance = calculateDistance(
          updatedPoints[0].point, 
          updatedPoints[1].point
        );
        
        // Add distance line
        const line = createMeasurementLine(
          updatedPoints[0].point, 
          updatedPoints[1].point,
          distance
        );
        sceneRef.current.add(line);
        
        // Update measurements
        setMeasurements(prev => ({
          ...prev,
          distances: [...prev.distances, { 
            points: [updatedPoints[0].point, updatedPoints[1].point],
            distance,
            line
          }]
        }));
        
        // Reset points for new measurement
        setMeasurePoints([]);
      }
    }
  };
  
  // Create visual marker for measurement points
  const createMarker = (position) => {
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    return marker;
  };
  
  // Calculate distance between two points
  const calculateDistance = (point1, point2) => {
    return point1.distanceTo(point2) * 3.28084; // Convert meters to feet
  };
  
  // Create a line between measurement points
  const createMeasurementLine = (point1, point2, distance) => {
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
    const line = new THREE.Line(geometry, material);
    
    // Create distance label
    // (In a real implementation, this would use HTML overlay or sprites)
    
    return line;
  };
  
  // Toggle measuring mode
  const toggleMeasuringMode = () => {
    setMeasuringMode(!measuringMode);
    
    // Clear existing measurements when switching modes
    if (!measuringMode) {
      // Remove markers and lines from previous measurements
      measurePoints.forEach(({ marker }) => {
        sceneRef.current.remove(marker);
      });
      
      measurements.distances.forEach(({ line }) => {
        sceneRef.current.remove(line);
      });
      
      setMeasurePoints([]);
      setMeasurements(prev => ({
        ...prev,
        distances: []
      }));
    }
  };
  
  // Toggle visibility of damage indicators
  const toggleDamageVisibility = () => {
    if (!roofModelRef.current) return;
    
    roofModelRef.current.traverse((child) => {
      if (child.isMesh && child.userData.isDamaged !== undefined) {
        // Toggle between damage material and original material
        if (child.userData.showingDamage) {
          child.material = child.userData.originalMaterial;
          child.userData.showingDamage = false;
        } else {
          child.userData.showingDamage = true;
          // Apply damage material based on type
          // (simplified implementation - would be more sophisticated in real app)
          child.material = new THREE.MeshStandardMaterial({ 
            color: 0xff0000, 
            opacity: 0.7, 
            transparent: true 
          });
        }
      }
    });
  };
  
  return (
    <div className="roof-3d-viewer">
      <div className="viewer-toolbar">
        <button 
          className={`toolbar-button ${measuringMode ? 'active' : ''}`}
          onClick={toggleMeasuringMode}
        >
          {measuringMode ? 'Exit Measuring' : 'Measure Roof'}
        </button>
        
        <button 
          className="toolbar-button"
          onClick={toggleDamageVisibility}
        >
          Toggle Damage View
        </button>
      </div>
      
      <div 
        className={`viewer-container ${measuringMode ? 'measuring' : ''}`}
        ref={mountRef}
        onClick={handleModelClick}
      />
      
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading 3D Model...</p>
        </div>
      )}
      
      <div className="measurements-panel">
        <h3>Roof Measurements</h3>
        
        <div className="measurement-item">
          <span className="measurement-label">Total Roof Area:</span>
          <span className="measurement-value">{measurements.totalRoofArea} sq ft</span>
        </div>
        
        {measurements.damagePercentage > 0 && (
          <div className="measurement-item damage">
            <span className="measurement-label">Damaged Area:</span>
            <span className="measurement-value">
              {measurements.totalDamageArea} sq ft ({measurements.damagePercentage}%)
            </span>
          </div>
        )}
        
        {measurements.distances.length > 0 && (
          <div className="distance-measurements">
            <h4>Distance Measurements:</h4>
            <ul>
              {measurements.distances.map((item, index) => (
                <li key={index}>
                  Measurement {index + 1}: {item.distance.toFixed(2)} ft
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {measurements.areas.length > 0 && (
          <div className="area-measurements">
            <h4>Damage By Type:</h4>
            <ul>
              {measurements.areas.map((item, index) => (
                <li key={index}>
                  {item.type}: {item.area.toFixed(2)} sq ft
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Roof3DViewer;
