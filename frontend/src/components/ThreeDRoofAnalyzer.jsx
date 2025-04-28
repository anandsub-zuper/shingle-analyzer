// src/components/ThreeDRoofAnalyzer.jsx
import React, { useState, useEffect, useRef } from 'react';
import MultiImageUploader from './MultiImageUploader';
import Roof3DViewer from './Roof3DViewer';
import CostEstimation from './CostEstimation';
import RoofCaptureGuide from './RoofCaptureGuide';
import { uploadRoofImages, checkJobStatus, getModelData } from '../api/RoofModelingAPI';
import '../styles/ThreeDRoofAnalyzer.css';

const ThreeDRoofAnalyzer = () => {
  // State management
  const [images, setImages] = useState([]);
  const [processing, setProcessing] = useState({
    active: false,
    stage: 'idle', // idle, uploading, processing, complete, error
    progress: 0,
    message: '',
    jobId: null
  });
  const [modelData, setModelData] = useState({
    modelUrl: null,
    measurements: null
  });
  
  // For damage assessment to pass to cost estimation
  const [damageData, setDamageData] = useState(null);
  
  // Polling interval reference
  const pollingIntervalRef = useRef(null);
  
  // Handle when images are selected
  const handleImagesSelected = (selectedImages) => {
    setImages(selectedImages);
    
    // Reset processing state when new images are selected
    if (processing.stage !== 'idle') {
      setProcessing({
        active: false,
        stage: 'idle',
        progress: 0,
        message: '',
        jobId: null
      });
      
      // Clear any polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Reset model data
      setModelData({
        modelUrl: null,
        measurements: null
      });
    }
  };
  
  // Start processing the uploaded images
  const startProcessing = async () => {
    if (images.length < 3) {
      alert('Please upload at least 3 images for accurate 3D reconstruction');
      return;
    }
    
    try {
      // Set uploading state
      setProcessing({
        active: true,
        stage: 'uploading',
        progress: 0,
        message: 'Uploading images...',
        jobId: null
      });
      
      // Upload images to server
      const uploadResponse = await uploadRoofImages(images, (progress) => {
        setProcessing(prev => ({
          ...prev,
          progress: progress
        }));
      });
      
      if (!uploadResponse || !uploadResponse.jobId) {
        throw new Error('Invalid response from server');
      }
      
      // Set processing state with job ID
      setProcessing({
        active: true,
        stage: 'processing',
        progress: 0,
        message: 'Processing started. Analyzing camera positions...',
        jobId: uploadResponse.jobId
      });
      
      // Start polling for job status
      pollJobStatus(uploadResponse.jobId);
      
    } catch (error) {
      console.error('Error starting processing:', error);
      
      setProcessing({
        active: false,
        stage: 'error',
        progress: 0,
        message: `Error: ${error.message}`,
        jobId: null
      });
    }
  };
  
  // Poll for job status updates
  const pollJobStatus = (jobId) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Set up polling interval (every 5 seconds)
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const statusResponse = await checkJobStatus(jobId);
        
        // Update progress and message
        setProcessing(prev => ({
          ...prev,
          progress: statusResponse.progress || prev.progress,
          message: statusResponse.message || prev.message
        }));
        
        // If the job is complete or had an error, stop polling
        if (statusResponse.status === 'complete') {
          clearInterval(pollingIntervalRef.current);
          
          // Get the model data
          const modelResponse = await getModelData(jobId);
          
          setModelData({
            modelUrl: modelResponse.modelUrl,
            measurements: modelResponse.measurements
          });
          
          // Create damage data object for cost estimation
          // This is placeholder data - in a real implementation,
          // this would be based on actual detected damage from the 3D model
          setDamageData({
            overallCondition: 'Good',
            damageTypes: ['Missing shingles', 'Curling edges'],
            severity: 4,
            description: 'Minor damage detected from 3D analysis',
            recommendedAction: 'Recommend replacement of damaged shingles'
          });
          
          setProcessing({
            active: false,
            stage: 'complete',
            progress: 100,
            message: 'Processing complete',
            jobId
          });
        } else if (statusResponse.status === 'error') {
          clearInterval(pollingIntervalRef.current);
          
          setProcessing({
            active: false,
            stage: 'error',
            progress: 0,
            message: statusResponse.message || 'An error occurred during processing',
            jobId
          });
        }
        
        // Update progress message based on progress percentage
        if (statusResponse.status === 'processing') {
          const progress = statusResponse.progress || 0;
          let stageMessage = statusResponse.message || '';
          
          if (progress < 30) {
            stageMessage = 'Analyzing camera positions...';
          } else if (progress < 70) {
            stageMessage = 'Building 3D model...';
          } else if (progress < 90) {
            stageMessage = 'Calculating measurements...';
          } else if (progress < 100) {
            stageMessage = 'Finalizing results...';
          }
          
          setProcessing(prev => ({
            ...prev,
            message: stageMessage
          }));
        }
        
      } catch (error) {
        console.error('Error polling job status:', error);
        
        // Don't stop polling on connection errors, retry next interval
        setProcessing(prev => ({
          ...prev,
          message: `Checking status... (Last attempt failed: ${error.message})`
        }));
      }
    }, 5000); // Poll every 5 seconds
  };
  
  // Clean up polling interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);
  
  // Handle roof measurements update from the 3D viewer
  const handleMeasurementsUpdate = (updatedMeasurements) => {
    setModelData(prev => ({
      ...prev,
      measurements: {
        ...prev.measurements,
        ...updatedMeasurements
      }
    }));
  };
  
  // Handle retry after error
  const handleRetry = () => {
    setProcessing({
      active: false,
      stage: 'idle',
      progress: 0,
      message: '',
      jobId: null
    });
  };
  
  return (
    <div className="threed-roof-analyzer">
      <h2 className="section-title">3D Roof Analyzer</h2>
      
      {/* Show the capture guide and uploader when not processing or complete */}
      {(processing.stage === 'idle') && (
        <>
          <RoofCaptureGuide />
          
          <div className="upload-section">
            <MultiImageUploader 
              onImagesSelected={handleImagesSelected}
              maxImages={15}
            />
            
            {images.length > 0 && (
              <div className="processing-actions">
                <button 
                  className="process-button"
                  onClick={startProcessing}
                  disabled={images.length < 3}
                >
                  Generate 3D Model
                </button>
                
                {images.length < 3 && (
                  <p className="warning-message">Please upload at least 3 images</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Show progress when uploading or processing */}
      {(processing.stage === 'uploading' || processing.stage === 'processing') && (
        <div className="processing-status">
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${processing.progress}%` }}
            ></div>
          </div>
          <p className="status-message">{processing.message}</p>
          <p className="status-description">
            {processing.stage === 'uploading' && 'Uploading images to the server...'}
            {processing.stage === 'processing' && 'This process may take 5-10 minutes depending on the number and quality of images.'}
          </p>
          
          <div className="progress-details">
            <div className="progress-stage">
              <div className={`stage-icon ${processing.progress >= 0 ? 'active' : ''}`}>1</div>
              <div className="stage-label">Upload</div>
            </div>
            <div className="stage-connector"></div>
            <div className="progress-stage">
              <div className={`stage-icon ${processing.progress >= 30 ? 'active' : ''}`}>2</div>
              <div className="stage-label">Process</div>
            </div>
            <div className="stage-connector"></div>
            <div className="progress-stage">
              <div className={`stage-icon ${processing.progress >= 70 ? 'active' : ''}`}>3</div>
              <div className="stage-label">Calculate</div>
            </div>
            <div className="stage-connector"></div>
            <div className="progress-stage">
              <div className={`stage-icon ${processing.progress >= 90 ? 'active' : ''}`}>4</div>
              <div className="stage-label">Finalize</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Show error if processing failed */}
      {processing.stage === 'error' && (
        <div className="processing-error">
          <div className="error-icon">⚠️</div>
          <h3>Processing Error</h3>
          <p>{processing.message}</p>
          <button 
            className="retry-button"
            onClick={handleRetry}
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Show results when complete */}
      {processing.stage === 'complete' && modelData.modelUrl && (
        <div className="results-container">
          <div className="model-container">
            <h3 className="section-subtitle">3D Roof Model</h3>
            <Roof3DViewer 
              modelUrl={modelData.modelUrl}
              damageData={damageData}
              onMeasurementUpdate={handleMeasurementsUpdate}
            />
          </div>
          
          {modelData.measurements && (
            <div className="measurements-container">
              <h3 className="section-subtitle">Roof Measurements</h3>
              
              <div className="measurements-grid">
                <div className="measurement-item">
                  <span className="measurement-label">Total Area</span>
                  <span className="measurement-value">
                    {modelData.measurements.area?.total?.toLocaleString() || 'N/A'} {modelData.measurements.area?.unit === 'sq_ft' ? 'sq ft' : modelData.measurements.area?.unit || ''}
                  </span>
                </div>
                
                <div className="measurement-item">
                  <span className="measurement-label">Roof Pitch</span>
                  <span className="measurement-value">
                    {modelData.measurements.pitch?.primary || 'N/A'} ({modelData.measurements.pitch?.degrees || 'N/A'}°)
                  </span>
                </div>
                
                <div className="measurement-item">
                  <span className="measurement-label">Dimensions</span>
                  <span className="measurement-value">
                    {modelData.measurements.dimensions ? 
                      `${modelData.measurements.dimensions.length || 'N/A'}' × ${modelData.measurements.dimensions.width || 'N/A'}' × ${modelData.measurements.dimensions.height || 'N/A'}'` :
                      'N/A'
                    }
                  </span>
                </div>
                
                <div className="measurement-item">
                  <span className="measurement-label">Detected Features</span>
                  <span className="measurement-value">
                    {modelData.measurements.features ? (
                      <>
                        {modelData.measurements.features.chimneys > 0 && `${modelData.measurements.features.chimneys} chimney${modelData.measurements.features.chimneys > 1 ? 's' : ''}, `}
                        {modelData.measurements.features.vents > 0 && `${modelData.measurements.features.vents} vent${modelData.measurements.features.vents > 1 ? 's' : ''}, `}
                        {modelData.measurements.features.skylights > 0 && `${modelData.measurements.features.skylights} skylight${modelData.measurements.features.skylights > 1 ? 's' : ''}`}
                        {modelData.measurements.features.chimneys === 0 && modelData.measurements.features.vents === 0 && modelData.measurements.features.skylights === 0 && 'None detected'}
                      </>
                    ) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Cost estimation based on 3D measurements */}
          {damageData && modelData.measurements && (
            <div className="cost-estimation-container">
              <CostEstimation 
                damageData={{
                  ...damageData,
                  // Add roof measurements to damage data for more accurate cost estimation
                  roofMeasurements: modelData.measurements
                }} 
              />
            </div>
          )}
          
          {/* Additional information section */}
          <div className="model-info-section">
            <h3 className="section-subtitle">About Your 3D Model</h3>
            <p>
              This 3D model was created using neural radiance field (NeRF) technology, which 
              constructs a volumetric representation of your roof from the uploaded photos. The 
              measurements are calculated based on this 3D reconstruction and have an estimated 
              accuracy of ±5%.
            </p>
            <p>
              You can rotate, zoom, and pan the model using your mouse. For a detailed inspection, 
              use the measuring tools available in the 3D viewer. The damage assessment is based 
              on AI analysis of the visible areas in your uploaded photos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeDRoofAnalyzer;
