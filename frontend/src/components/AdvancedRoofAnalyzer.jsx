// src/components/AdvancedRoofAnalyzer.jsx
import React, { useState, useEffect, useRef } from 'react';
import MultiImageUploader from './MultiImageUploader';
import EnhancedResultsDisplay from './EnhancedResultsDisplay';
import LoadingSpinner from './LoadingSpinner';
import '../styles/ShingleAnalyzer.css';
import '../styles/AdvancedRoofAnalyzer.css';

const AdvancedRoofAnalyzer = () => {
  const [images, setImages] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');
  
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  // Reference to store abort controller
  const abortControllerRef = useRef(null);
  // Timeout ID for simulated progress
  const progressTimerRef = useRef(null);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Abort any in-progress fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clear any progress timers
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // Check if the advanced server is awake
  useEffect(() => {
    const pingServer = async () => {
      try {
        const response = await fetch('http://localhost:3002/test', {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
        });
        
        if (response.ok) {
          console.log('Advanced analysis server is online');
        } else {
          console.log('Advanced analysis server returned error status');
        }
      } catch (error) {
        console.log('Could not connect to advanced analysis server - server might be offline');
      }
    };
    
    pingServer();
  }, []);

  // Handle image selection from the uploader
  const handleImagesSelected = (selectedImages) => {
    setImages(selectedImages);
    
    // Reset previous analysis results
    if (results) {
      setResults(null);
      setError(null);
    }
    
    // Set time estimate based on number of images
    updateTimeEstimate(selectedImages.length);
  };
  
  // Update time estimate based on image count
  const updateTimeEstimate = (imageCount) => {
    let estimate = '';
    
    if (imageCount <= 0) {
      estimate = '';
    } else if (imageCount <= 5) {
      estimate = '1-2 minutes';
    } else if (imageCount <= 10) {
      estimate = '2-4 minutes';
    } else {
      estimate = '4-6 minutes';
    }
    
    setTimeEstimate(estimate);
  };

  // Start simulated progress to provide better UX during long requests
  const startProgressSimulation = () => {
    // Clear any existing timer
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    
    // Reset progress
    setProgress(0);
    setProcessingStage('Uploading images');
    
    // Total expected duration based on image count (in milliseconds)
    const totalDuration = images.length <= 5 ? 90000 : // 1.5 minutes for ≤5 images
                          images.length <= 10 ? 180000 : // 3 minutes for 6-10 images
                          300000; // 5 minutes for 11-15 images
    
    // Update interval (500ms)
    const updateInterval = 500;
    
    // Maximum progress to show during simulation (95%)
    const maxProgress = 95;
    
    // Start time to measure elapsed time
    const startTime = Date.now();
    
    // Progress stages with their thresholds
    const stages = [
      { progress: 10, name: 'Uploading images' },
      { progress: 25, name: 'Analyzing image content' },
      { progress: 40, name: 'Identifying roof structure' },
      { progress: 60, name: 'Calculating measurements' },
      { progress: 80, name: 'Assessing damage' },
      { progress: 90, name: 'Generating recommendations' },
      { progress: 95, name: 'Finalizing results' }
    ];
    
    // Start interval for updating progress
    progressTimerRef.current = setInterval(() => {
      if (!isMounted.current) {
        clearInterval(progressTimerRef.current);
        return;
      }
      
      // Calculate elapsed time
      const elapsed = Date.now() - startTime;
      
      // Calculate progress percentage (with easing function for more realistic progress)
      // Start faster, slow down towards the end
      const rawProgress = (elapsed / totalDuration) * 100;
      const easedProgress = Math.min(maxProgress, rawProgress * (1 - rawProgress / 200));
      
      // Update progress
      setProgress(Math.round(easedProgress));
      
      // Update stage based on progress
      for (let i = stages.length - 1; i >= 0; i--) {
        if (easedProgress >= stages[i].progress) {
          setProcessingStage(stages[i].name);
          break;
        }
      }
      
      // Stop simulation at max progress
      if (easedProgress >= maxProgress) {
        clearInterval(progressTimerRef.current);
      }
    }, updateInterval);
    
    return () => clearInterval(progressTimerRef.current);
  };

  // Convert images to base64 strings
  const convertImagesToBase64 = async (imageFiles) => {
    const base64Images = [];
    
    for (const file of imageFiles) {
      try {
        const base64String = await readFileAsBase64(file);
        base64Images.push(base64String);
      } catch (error) {
        console.error(`Error converting image ${file.name} to base64:`, error);
        throw new Error(`Failed to process image ${file.name}: ${error.message}`);
      }
    }
    
    return base64Images;
  };

  // Helper function to read file as base64
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        } catch (error) {
          reject(new Error("Error extracting base64 data"));
        }
      };
      reader.onerror = () => {
        reject(new Error("Error reading file"));
      };
      reader.readAsDataURL(file);
    });
  };

  // Analyze the images
  const analyzeImages = async () => {
    if (!images || images.length === 0) {
      setError("Please upload at least one image first");
      return;
    }
    
    if (images.length < 3) {
      setError("For optimal results, please upload at least 3 images showing different angles of the roof");
      return;
    }

    // Reset state before starting
    setAnalyzing(true);
    setError(null);
    setResults(null);
    setProgress(0);
    
    // Start progress simulation for better UX
    startProgressSimulation();
    
    // Create a new AbortController for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      // Convert images to base64
      const base64Images = await convertImagesToBase64(images);
      
      console.log(`Sending ${base64Images.length} images for analysis...`);
      
      // Call the API
      const response = await fetch('http://localhost:3002/api/analyze-roof-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: base64Images
        }),
        signal: abortControllerRef.current.signal
      });
      
      // Stop progress simulation
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      
      // Set to 100% when complete
      setProgress(100);
      setProcessingStage('Analysis complete');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (isMounted.current) {
        console.log("Analysis complete, setting results");
        
        // Add a slight delay to allow the UI to show 100% progress
        setTimeout(() => {
          setResults(data);
          setAnalyzing(false);
        }, 500);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error("Error in image analysis:", err);
        
        // Provide user-friendly error message based on error type
        if (err.name === 'AbortError') {
          setError("Request was cancelled. Please try again.");
        } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
          setError("Could not connect to the analysis server. Please check if the advanced server is running.");
        } else if (err.message.includes('timeout')) {
          setError("Analysis took too long to complete. Please try with fewer images or optimize their size.");
        } else {
          setError(`Error analyzing images: ${err.message}`);
        }
        
        // Stop progress simulation
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
        }
        
        setAnalyzing(false);
      }
    }
  };

  // Cancel the ongoing analysis
  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    
    setAnalyzing(false);
    setProgress(0);
    setProcessingStage('');
  };

  return (
    <div className="advanced-analyzer-container">
      <div className="advanced-analyzer-header">
        <h1 className="analyzer-title">Advanced Roof Analysis</h1>
        <p className="analyzer-description">
          Upload multiple images of your roof from different angles for comprehensive 3D measurement and assessment.
        </p>
      </div>
      
      <div className="info-banner">
        <div className="info-icon">ℹ️</div>
        <div className="info-content">
          <h3>Why use Advanced Analysis?</h3>
          <p>
            By analyzing multiple images together, our AI can triangulate measurements with higher precision,
            generate 3D understanding of your roof structure, and provide more accurate material quantity estimates
            for repairs or replacement.
          </p>
          <h4>Recommended: 8-10 images from different angles</h4>
          <ul className="image-guidelines">
            <li>Take photos from all four sides of the building</li>
            <li>Include corner angles to show multiple roof faces</li>
            <li>Add close-up images of any damaged areas</li>
            <li>Ensure photos have good lighting and clear visibility</li>
          </ul>
        </div>
      </div>
      
      <div className="upload-section">
        <div className="form-group">
          <label className="input-label">Upload Multiple Roof Images</label>
          <MultiImageUploader 
            onImagesSelected={handleImagesSelected}
            maxImages={15}
            isAdvanced={true}
          />
          <p className="input-help-text">
            {images.length > 0 ? (
              <>
                {images.length} {images.length === 1 ? 'image' : 'images'} selected. 
                {images.length < 3 ? (
                  <span className="warning-text"> Please upload at least 3 images for effective analysis.</span>
                ) : images.length < 8 ? (
                  <span className="note-text"> For optimal results, 8-10 images are recommended.</span>
                ) : (
                  <span className="success-text"> Good image count for detailed analysis.</span>
                )}
              </>
            ) : (
              'Upload multiple clear images of your roof from different angles for best results'
            )}
          </p>
        </div>
        
        <div className="button-group">
          <button
            onClick={analyzeImages}
            disabled={!images.length || analyzing || images.length < 1}
            className={`analyze-button ${(!images.length || analyzing) ? 'button-disabled' : ''}`}
          >
            {analyzing ? (
              <>
                <span className="simple-spinner"></span>
                Analyzing...
              </>
            ) : (
              <>
                <span className="analyze-icon"></span>
                Analyze {images.length} Images
              </>
            )}
          </button>
          
          {timeEstimate && !analyzing && (
            <div className="time-estimate">
              <span className="time-icon">⏱️</span>
              Estimated analysis time: {timeEstimate}
            </div>
          )}
          
          {analyzing && (
            <button
              onClick={cancelAnalysis}
              className="cancel-button"
            >
              Cancel Analysis
            </button>
          )}
        </div>
      </div>
      
      {/* Enhanced Progress Indicator */}
      {analyzing && (
        <div className="advanced-progress-container">
          <div className="progress-header">
            <h3>{processingStage}</h3>
            <span className="progress-percentage">{progress}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="processing-stages">
            <div className={`stage ${progress >= 10 ? 'completed' : ''}`}>Upload</div>
            <div className="stage-separator" />
            <div className={`stage ${progress >= 40 ? 'completed' : progress >= 25 ? 'active' : ''}`}>Analysis</div>
            <div className="stage-separator" />
            <div className={`stage ${progress >= 80 ? 'completed' : progress >= 60 ? 'active' : ''}`}>Measurement</div>
            <div className="stage-separator" />
            <div className={`stage ${progress >= 95 ? 'completed' : progress >= 90 ? 'active' : ''}`}>Results</div>
          </div>
          <p className="progress-description">
            {progress < 25 && "Uploading and preparing your images for analysis..."}
            {progress >= 25 && progress < 60 && "AI is analyzing roof features, materials, and structure..."}
            {progress >= 60 && progress < 90 && "Calculating precise measurements using multiple image perspectives..."}
            {progress >= 90 && "Finalizing results and generating comprehensive assessment..."}
          </p>
          <p className="patience-note">
            Analyzing multiple images requires intensive processing. 
            Please be patient as we work to provide the most accurate assessment.
          </p>
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="error-message">
          <span className="error-icon"></span>
          {error}
        </div>
      )}
      
      {/* Results display */}
      {results && (
        <div className="advanced-results-container">
          <div className="results-header">
            <div className="results-title">
              <h2 className="advanced-analysis-title">Advanced Roof Analysis Results</h2>
              <p className="analysis-completed">
                <span className="checkmark-icon check-icon"></span>
                Multi-Image Analysis Complete
              </p>
              <p className="images-analyzed">
                {results.imageCount ? `${results.imageCount} images analyzed` : `Multiple images analyzed`}
              </p>
            </div>
            <div className="analysis-method">
              <p className="method-label">Analysis Method</p>
              <p className="method-value">Advanced AI Multi-Perspective Analysis</p>
            </div>
          </div>
          
          {/* Enhanced Results Display */}
          <EnhancedResultsDisplay 
            results={results} 
            isAdvancedAnalysis={true}
          />
          
          <div className="info-section">
            <h3 className="section-subtitle">How Advanced Analysis Works</h3>
            <p className="info-text">
              Our advanced analysis combines multiple image perspectives to create a comprehensive understanding of your roof.
              By triangulating measurements from different angles, the AI can provide more accurate dimensions, area calculations,
              and damage assessments than would be possible from a single image. This approach uses photogrammetry principles
              similar to those used in professional roof measurement software.
            </p>
          </div>
          
          <div className="info-section">
            <h3 className="section-subtitle">Measurement Accuracy</h3>
            <p className="info-text">
              Measurements are calculated by identifying common reference points across multiple images and
              establishing scale using standard architectural elements. Confidence scores indicate the reliability
              of each measurement based on visibility, reference clarity, and triangulation quality.
              For the most accurate results, we recommend verifying critical measurements with a professional inspection.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedRoofAnalyzer;
