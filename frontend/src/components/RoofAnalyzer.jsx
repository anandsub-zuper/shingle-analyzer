// src/components/RoofAnalyzer.jsx
import { useState } from 'react';
import EnhancedResultsDisplay from './EnhancedResultsDisplay';
import LoadingSpinner from './LoadingSpinner';
import '../styles/ShingleAnalyzer.css';
import '../styles/EnhancedResultsDisplay.css';

const RoofAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file change event
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (selectedFile) {
      // Check if file type is supported
      const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      
      if (!supportedTypes.includes(selectedFile.type)) {
        setError("Unsupported file format. Please upload PNG, JPEG, GIF, or WEBP images only.");
        return;
      }
      
      setFile(selectedFile);
      
      // Create a preview of the uploaded image
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(selectedFile);
      
      // Reset previous results
      setResults(null);
      setRawResponse(null);
      setError(null);
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
      const droppedFile = e.dataTransfer.files[0];
      
      // Check file type
      const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      
      if (!supportedTypes.includes(droppedFile.type)) {
        setError("Unsupported file format. Please upload PNG, JPEG, GIF, or WEBP images only.");
        return;
      }
      
      setFile(droppedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(droppedFile);
      
      // Reset previous results
      setResults(null);
      setRawResponse(null);
      setError(null);
    }
  };

  // Analyze the image
  const analyzeImage = async () => {
    if (!file) {
      setError("Please upload an image first");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResults(null);
    setRawResponse(null);
    
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          // Extract base64 data without the prefix
          const base64Image = reader.result.split(',')[1];
          
          console.log("Sending API request...");
          
          // Call your backend API
          const response = await fetch('https://shingle-analyzer-cf8f8df19174.herokuapp.com/api/analyze-shingle', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image
            })
          });
          
          console.log("API response received, parsing JSON...");
          const data = await response.json();
          console.log("JSON parsed successfully");
          
          if (response.ok) {
            console.log("Response OK, storing results");
            
            // Add a slight delay to allow the loading animation to complete
            setTimeout(() => {
              // Store the raw API response for debugging
              setRawResponse(data);
              
              // Process the response for display
              if (data.choices && data.choices[0] && data.choices[0].message) {
                console.log("Message found in response");
                setResults(data);
              } else {
                console.error("No message found in API response:", data);
                throw new Error("Unexpected API response structure");
              }
              setAnalyzing(false);
            }, 2000);
          } else {
            console.error("API error:", data);
            throw new Error(`API error: ${data.error?.message || data.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error("Error in API call:", error);
          setError("Error calling API: " + error.message);
          setAnalyzing(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        setError("Error reading file: " + error.message);
        setAnalyzing(false);
      };
    } catch (err) {
      console.error("General error:", err);
      setError("Error analyzing image: " + err.message);
      setAnalyzing(false);
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
        
        <button
          onClick={analyzeImage}
          disabled={!file || analyzing}
          className={`analyze-button ${(!file || analyzing) ? 'button-disabled' : ''}`}
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
      </div>
      
      {/* Enhanced Loading Spinner */}
      <LoadingSpinner 
        isLoading={analyzing} 
        loadingText="This may take up to 30 seconds"
      />
      
      {error && (
        <div className="error-message">
          <span className="error-icon"></span>
          {error}
        </div>
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
        </div>
      )}
    </div>
  );
};

export default RoofAnalyzer;
