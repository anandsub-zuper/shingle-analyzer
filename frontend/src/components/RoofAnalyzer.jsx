// src/components/RoofAnalyzer.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EnhancedResultsDisplay from './EnhancedResultsDisplay';
import LoadingSpinner from './LoadingSpinner';
import DebugHelper from './DebugHelper';
import '../styles/ShingleAnalyzer.css';
import '../styles/EnhancedResultsDisplay.css';

const RoofAnalyzer = ({ onAnalysisComplete }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [base64Image, setBase64Image] = useState(null);
  
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  // Reference to store abort controller
  const abortControllerRef = useRef(null);
  // Reference to track retry attempts
  const retryAttemptsRef = useRef(0);
  // Max number of retry attempts
  const MAX_RETRIES = 3;
  // Retry delay in milliseconds (exponential backoff)
  const getRetryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Abort any in-progress fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Check if the Heroku server is awake
  useEffect(() => {
    // Ping the server to wake it up when the component mounts
    const pingServer = async () => {
      try {
        await fetch('https://shingle-analyzer-cf8f8df19174.herokuapp.com/test', {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
        });
        console.log('Server ping successful');
      } catch (error) {
        console.log('Server ping failed - server might be asleep');
      }
    };
    
    pingServer();
  }, []);

  // Call onAnalysisComplete when results are available
  useEffect(() => {
    if (results && onAnalysisComplete) {
      onAnalysisComplete(results, base64Image);
    }
  }, [results, base64Image, onAnalysisComplete]);

  // Handle file change event with error handling
  const handleFileChange = (e) => {
    try {
      const selectedFile = e.target.files[0];
      
      if (selectedFile) {
        // Check if file type is supported
        const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        
        if (!supportedTypes.includes(selectedFile.type)) {
          setError("Unsupported file format. Please upload PNG, JPEG, GIF, or WEBP images only.");
          return;
        }
        
        // Check file size (max 10MB)
        if (selectedFile.size > 10 * 1024 * 1024) {
          setError("File is too large. Maximum file size is 10MB.");
          return;
        }
        
        setFile(selectedFile);
        
        // Create a preview of the uploaded image
        const reader = new FileReader();
        reader.onload = (e) => {
          if (isMounted.current) {
            setPreview(e.target.result);
            
            // Store base64 image for later use
            try {
              const base64String = e.target.result.split(',')[1];
              setBase64Image(base64String);
            } catch (error) {
              console.error("Error extracting base64:", error);
            }
          }
        };
        reader.onerror = () => {
          if (isMounted.current) {
            setError("Error reading file. Please try another image.");
          }
        };
        reader.readAsDataURL(selectedFile);
        
        // Reset previous results
        setResults(null);
        setRawResponse(null);
        setError(null);
      }
    } catch (err) {
      console.error("Error handling file:", err);
      setError("Error processing file. Please try again.");
    }
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Unified file selection handler to avoid code duplication
  const handleFileSelection = (selectedFile) => {
    try {
      // Check file type
      const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      
      if (!supportedTypes.includes(selectedFile.type)) {
        setError("Unsupported file format. Please upload PNG, JPEG, GIF, or WEBP images only.");
        return;
      }
      
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File is too large. Maximum file size is 10MB.");
        return;
      }
      
      setFile(selectedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (isMounted.current) {
          setPreview(e.target.result);
          
          // Store base64 image for later use
          try {
            const base64String = e.target.result.split(',')[1];
            setBase64Image(base64String);
          } catch (error) {
            console.error("Error extracting base64:", error);
          }
        }
      };
      reader.onerror = () => {
        if (isMounted.current) {
          setError("Error reading file. Please try another image.");
        }
      };
      reader.readAsDataURL(selectedFile);
      
      // Reset previous results
      setResults(null);
      setRawResponse(null);
      setError(null);
    } catch (err) {
      console.error("Error handling file selection:", err);
      setError("Error processing file. Please try again.");
    }
  };

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  // Reset all state
  const resetAnalysis = () => {
    setResults(null);
    setRawResponse(null);
    setError(null);
    setAnalyzing(false);
    retryAttemptsRef.current = 0;
  };
  
  // Retry the analysis
  const retryAnalysis = () => {
    resetAnalysis();
    setTimeout(() => {
      analyzeImage();
    }, 500);
  };
  
  // Go to insurance report after analysis
  const goToInsuranceReport = () => {
    if (results) {
      navigate('/insurance-report');
    }
  };

  // Analyze the image with retry logic and better error handling
  const analyzeImage = async () => {
    if (!file) {
      setError("Please upload an image first");
      return;
    }

    // Reset state before starting
    setAnalyzing(true);
    setError(null);
    setResults(null);
    setRawResponse(null);
    
    // Create a new AbortController for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      // Convert image to base64
      const base64Image = await readFileAsBase64(file);
      if (!base64Image) {
        throw new Error("Failed to convert image to base64");
      }
      
      console.log("Sending API request...");
      
      // Try to call API with timeout and retry logic
      const response = await callApiWithRetry(base64Image);
      
      // Process the successful response
      if (isMounted.current) {
        console.log("API request successful");
        // Reset retry attempts on success
        retryAttemptsRef.current = 0;
        
        // Add a slight delay to allow the loading animation to complete
        setTimeout(() => {
          setRawResponse(response);
          setResults(response);
          setAnalyzing(false);
        }, 1000);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error("Final error in analysis:", err);
        
        // Provide user-friendly error message based on error type
        if (err.name === 'AbortError') {
          setError("Request was cancelled. Please try again.");
        } else if (err.message.includes('CORS')) {
          setError("Server connection issue. Please try again in a moment.");
        } else if (err.message.includes('Failed to fetch')) {
          setError("Could not connect to the analysis server. Please check your internet connection and try again.");
        } else if (err.message.includes('timeout')) {
          setError("Server took too long to respond. The server might be busy, please try again.");
        } else {
          setError(`Error analyzing image: ${err.message}`);
        }
        
        setAnalyzing(false);
      }
    }
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

  // Helper function to call API with retry logic
  const callApiWithRetry = async (base64Image, attempt = 0) => {
    const TIMEOUT_MS = 60000; // 60 second timeout
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout. The server took too long to respond.'));
        }, TIMEOUT_MS);
      });
      
      // Create the fetch promise
      const fetchPromise = fetch('https://shingle-analyzer-cf8f8df19174.herokuapp.com/api/analyze-shingle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image
        }),
        signal: abortControllerRef.current.signal
      });
      
      // Race the timeout against the fetch
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`API error: ${data.error?.message || data.error || 'Unknown error'}`);
      }
      
      return data;
    } catch (err) {
      console.error(`API attempt ${attempt + 1} failed:`, err);
      
      // Retry logic - only retry on network errors, not on API errors
      const shouldRetry = (
        attempt < MAX_RETRIES && 
        (err.message.includes('Failed to fetch') || 
         err.message.includes('timeout') || 
         err.message.includes('CORS') ||
         err.name === 'TypeError')
      );
      
      if (shouldRetry && isMounted.current) {
        const retryDelay = getRetryDelay(attempt);
        console.log(`Retrying in ${retryDelay}ms... (Attempt ${attempt + 1} of ${MAX_RETRIES})`);
        
        // Update UI to show retry attempt
        setError(`Connection issue, retrying (${attempt + 1}/${MAX_RETRIES})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Make sure component is still mounted before retrying
        if (isMounted.current) {
          // Recursively retry
          return callApiWithRetry(base64Image, attempt + 1);
        } else {
          throw new Error('Component unmounted during retry');
        }
      }
      
      // If we shouldn't retry or we've exhausted retries, rethrow the error
      throw err;
    }
  };

  return (
    <div className="shingle-analyzer-container">
      <h1 className="analyzer-title">Roof Analyzer</h1>
      
      <div className="upload-section">
        <div className="form-group">
          <label className="input-label">Upload Roof Image</label>
          <div 
            className={`file-input-wrapper ${dragActive ? 'active-drag' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className="file-input-icon upload-icon"></div>
            <div className="file-input-text">Drag & drop your image here or click to browse</div>
            <div className="file-input-description">Supported formats: PNG, JPEG, GIF, WEBP</div>
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
              onChange={handleFileChange}
              className="file-input"
              disabled={analyzing}
            />
          </div>
          <p className="input-help-text">
            Upload a clear image of your roof or shingles for best results
          </p>
        </div>
        
        {preview && (
          <div className="preview-container">
            <h2 className="section-title">Preview</h2>
            <div className="image-preview">
              <img 
                src={preview} 
                alt="Roof preview" 
                className="preview-image"
              />
            </div>
          </div>
        )}
        
        <div className="button-group">
          <button
            onClick={analyzeImage}
            disabled={!file || analyzing}
            className={`analyze-button ${(!file || analyzing) ? 'button-disabled' : ''}`}
            style={{ flex: '1' }}
          >
            {analyzing ? (
              <>
                <span className="simple-spinner"></span>
                Analyzing...
              </>
            ) : (
              <>
                <span className="analyze-icon"></span>
                Analyze Roof
              </>
            )}
          </button>
          
          <button
            onClick={toggleDebugMode}
            className={`debug-toggle ${debugMode ? 'active' : ''}`}
          >
            {debugMode ? 'Hide Debug' : 'Debug Mode'}
          </button>
        </div>
      </div>
      
      {/* Enhanced Loading Spinner */}
      <LoadingSpinner 
        isLoading={analyzing} 
        loadingText="Analysis may take up to 60 seconds"
      />
      
      {error && (
        <div className="error-message">
          <span className="error-icon"></span>
          {error}
          {error.includes('server') || error.includes('connection') ? (
            <button 
              onClick={retryAnalysis}
              className="retry-button"
              style={{
                marginLeft: '15px',
                padding: '5px 10px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          ) : null}
        </div>
      )}
      
      {/* Debug Helper - only shown when in debug mode and results are available */}
      {debugMode && (results || error) && (
        <DebugHelper apiResponse={results} error={error} />
      )}
      
      {results && (
        <div className="results-container">
          <div className="results-header">
            <div className="results-title">
              <h2 className="shingle-name">Roof Analysis Results</h2>
              <p className="analysis-completed">
                <span className="checkmark-icon check-icon"></span>
                Analysis Complete
              </p>
            </div>
            <div className="analysis-method">
              <p className="method-label">Powered by</p>
              <p className="method-value">AI Vision Analysis</p>
            </div>
          </div>
          
          {/* Action buttons for results */}
          <div className="results-actions">
            <button 
              className="insurance-report-button"
              onClick={goToInsuranceReport}
            >
              Generate Insurance Report
            </button>
          </div>
          
          {/* Enhanced Results Display */}
          <EnhancedResultsDisplay results={results} />
          
          <div className="info-section">
            <h3 className="section-subtitle">How This Works</h3>
            <p className="info-text">
              This analyzer uses advanced AI vision technology to identify roofing characteristics. 
              The AI examines visual patterns, textures, and colors to determine material type, 
              manufacturer, and specifications. Results include detailed damage assessment and 
              repair recommendations based on your uploaded image.
            </p>
          </div>
          
          <div className="info-section">
            <h3 className="section-subtitle">Additional Information</h3>
            <p className="info-text">
              This analysis is based on visual characteristics of your roof. For precise 
              specifications and detailed repair quotes, please consult a professional roofing contractor. 
              Results may vary based on image quality and lighting conditions.
            </p>
          </div>
          
          {/* Floating action button for insurance report */}
          <div className="floating-insurance-button">
            <button
              onClick={goToInsuranceReport}
              className="floating-button"
              title="Generate Insurance Report"
            >
              📄 Generate Insurance Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoofAnalyzer;
