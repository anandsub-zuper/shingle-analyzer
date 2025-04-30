// src/components/EnhancedShingleAnalyzer.jsx
import { useState } from 'react';
import EnhancedResultsDisplay from './EnhancedResultsDisplay';
import responseUtils from '../utils/responseUtils';
import '../styles/ShingleAnalyzer.css';
import '../styles/EnhancedResultsDisplay.css';

const EnhancedShingleAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [enhancedMetrics, setEnhancedMetrics] = useState(null);

  // Handle file change event - preserves your existing validation pattern
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
      setError(null);
      setEnhancedMetrics(null);
    }
  };

  // Analyze the image - matches your existing pattern for image processing
  const analyzeImage = async () => {
    if (!file) {
      setError("Please upload an image first");
      return;
    }

    setAnalyzing(true);
    setError(null);
    
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          // Extract base64 data without the prefix
          const base64Image = reader.result.split(',')[1];
          
          // Call your backend API - using the exact same endpoint pattern
          const response = await fetch('https://shingle-analyzer-cf8f8df19174.herokuapp.com/api/analyze-shingle', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image
            })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
              // Following your existing response handling pattern
              const gptResponse = data.choices[0].message.content;
              
              try {
                // Try to parse the response
                let parsedResponse;
                
                // Handle content that might be a string representation of JSON
                if (typeof gptResponse === 'string') {
                  // Try to extract JSON if it's within the string
                  const jsonMatch = gptResponse.match(/\{.*\}/s);
                  if (jsonMatch) {
                    try {
                      parsedResponse = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                      parsedResponse = null;
                    }
                  }
                  
                  // If extraction failed or no match, try parsing the whole string
                  if (!parsedResponse) {
                    try {
                      parsedResponse = JSON.parse(gptResponse);
                    } catch (e) {
                      // Continue to fallback handling
                    }
                  }
                } else if (typeof gptResponse === 'object') {
                  // If it's already an object, use it directly
                  parsedResponse = gptResponse;
                }
                
                // If parsing was successful
                if (parsedResponse) {
                  // Calculate enhanced metrics
                  calculateEnhancedMetrics(parsedResponse);
                  
                  // Store results for display
                  setResults({
                    specifications: parsedResponse,
                    rawResponse: typeof gptResponse === 'string' ? gptResponse : JSON.stringify(gptResponse, null, 2)
                  });
                } else {
                  throw new Error("Could not parse response as JSON");
                }
              } catch (e) {
                // Extract useful info from text response - following your existing fallback pattern
                let name = "Detected Shingle";
                let manufacturer = "Unknown Manufacturer";
                
                if (typeof gptResponse === 'string') {
                  // Try to extract basic info from the text
                  if (gptResponse.includes("asphalt")) {
                    name = "Asphalt Shingle";
                  } else if (gptResponse.includes("wood") || gptResponse.includes("cedar")) {
                    name = "Wood Shingle";
                  } else if (gptResponse.includes("slate")) {
                    name = "Slate Shingle";
                  } else if (gptResponse.includes("metal")) {
                    name = "Metal Roofing";
                  }
                  
                  // Try to extract manufacturer if mentioned
                  const commonManufacturers = ["GAF", "Owens Corning", "CertainTeed", "Malarkey", "IKO", "TAMKO", "Atlas"];
                  for (const mfr of commonManufacturers) {
                    if (gptResponse.includes(mfr)) {
                      manufacturer = mfr;
                      break;
                    }
                  }
                }
                
                // Create a simplified response object following your pattern
                const simplifiedResponse = {
                  materialSpecification: {
                    name: name,
                    manufacturer: manufacturer,
                    productLine: "Unknown",
                    material: name.split(" ")[0],
                    materialSubtype: "Unknown",
                    weight: "Unknown",
                    dimensions: "Unknown",
                    thickness: "Unknown",
                    estimatedAge: "Unknown",
                    lifespan: "Unknown",
                    pattern: "Unknown",
                    warranty: "Unknown"
                  },
                  damageAssessment: {
                    overallCondition: 'Unknown',
                    damageTypes: [],
                    damageSeverity: 0,
                    description: 'Unable to assess damage from the provided image',
                    recommendedAction: 'Consider a professional inspection'
                  },
                  repairAssessment: {
                    repairRecommendation: "Unknown",
                    urgency: "Unknown",
                    repairDifficulty: "Unknown",
                    diyFeasibility: false
                  },
                  metadata: {
                    confidenceScore: 0,
                    visibleSectionEstimate: 0,
                    visibilityQuality: "Poor",
                    limitationNotes: "Unable to process detailed analysis",
                    additionalInspectionNeeded: true
                  },
                  rawText: typeof gptResponse === 'string' ? gptResponse : "No text response available"
                };
                
                // Calculate basic metrics
                calculateEnhancedMetrics(simplifiedResponse);
                
                // Set results with simplified response
                setResults({
                  specifications: simplifiedResponse,
                  rawResponse: typeof gptResponse === 'string' ? gptResponse : JSON.stringify(gptResponse, null, 2)
                });
              }
            } else {
              throw new Error("Unexpected API response structure");
            }
          } else {
            throw new Error(`API error: ${data.error?.message || data.error || 'Unknown error'}`);
          }
          setAnalyzing(false);
        } catch (error) {
          setError("Error calling API: " + error.message);
          setAnalyzing(false);
        }
      };
      
      reader.onerror = (error) => {
        setError("Error reading file: " + error.message);
        setAnalyzing(false);
      };
    } catch (err) {
      setError("Error analyzing image: " + err.message);
      setAnalyzing(false);
    }
  };

  // Calculate enhanced metrics from the analysis results
  const calculateEnhancedMetrics = (analysisData) => {
    try {
      if (!analysisData) return;
      
      const materialSpecification = analysisData.materialSpecification || {};
      const damageAssessment = analysisData.damageAssessment || {};
      
      // Calculate enhanced metrics
      const totalDamagePercentage = responseUtils.calculateTotalDamagePercentage(damageAssessment);
      const remainingLife = responseUtils.calculateRemainingLife(materialSpecification, damageAssessment);
      const repairPriority = responseUtils.getRepairPriority(damageAssessment);
      const costEstimates = responseUtils.estimateRepairCosts(damageAssessment, materialSpecification);
      const repairOrReplace = responseUtils.getRepairOrReplaceRecommendation(
        damageAssessment, 
        materialSpecification
      );
      
      // Set enhanced metrics
      setEnhancedMetrics({
        totalDamagePercentage,
        remainingLife,
        repairPriority,
        costEstimates,
        repairOrReplace
      });
    } catch (error) {
      console.error("Error calculating enhanced metrics:", error);
      // Do not set state on error to avoid rendering issues
    }
  };

  // Render enhanced metrics summary
  const renderEnhancedMetrics = () => {
    if (!enhancedMetrics) return null;
    
    return (
      <div className="enhanced-metrics-container">
        <h3 className="section-subtitle">Enhanced Analysis Metrics</h3>
        
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Total Affected Area</span>
            <span className="metric-value">{enhancedMetrics.totalDamagePercentage}%</span>
          </div>
          
          <div className="metric-item">
            <span className="metric-label">Remaining Roof Life</span>
            <span className="metric-value">{enhancedMetrics.remainingLife.years}</span>
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${enhancedMetrics.remainingLife.percentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="metric-item">
            <span className="metric-label">Repair Priority</span>
            <span className="metric-value">{enhancedMetrics.repairPriority}</span>
          </div>
          
          <div className="metric-item">
            <span className="metric-label">Estimated Repair Cost</span>
            <span className="metric-value">{enhancedMetrics.costEstimates.repair}</span>
          </div>
          
          <div className="metric-item">
            <span className="metric-label">Estimated Replacement Cost</span>
            <span className="metric-value">{enhancedMetrics.costEstimates.replacement}</span>
          </div>
          
          <div className="metric-item recommendation-item">
            <span className="metric-label">Recommendation</span>
            <span className="metric-value recommendation-value">
              {enhancedMetrics.repairOrReplace.recommendation}
            </span>
            <p className="recommendation-reasoning">
              {enhancedMetrics.repairOrReplace.reasoning}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="shingle-analyzer-container">
      <h1 className="analyzer-title">Enhanced Roof Shingle Analyzer</h1>
      
      <div className="upload-section">
        <div className="form-group">
          <label className="input-label">Upload Shingle Image</label>
          <div className="file-input-wrapper">
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
            Upload a clear image of the roofing shingle for best results
          </p>
        </div>
        
        {preview && (
          <div className="preview-container">
            <h2 className="section-title">Preview</h2>
            <div className="image-preview">
              <img 
                src={preview} 
                alt="Shingle preview" 
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
              <span className="loading-spinner"></span>
              Analyzing...
            </>
          ) : (
            <>
              <span className="analyze-icon"></span>
              Analyze Shingle
            </>
          )}
        </button>
      </div>
      
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
              <h2 className="shingle-name">{results.specifications.materialSpecification?.name || "Analyzed Shingle"}</h2>
              <p className="analysis-completed">
                <span className="checkmark-icon check-icon"></span>
                Analysis Complete
              </p>
            </div>
            <div className="analysis-method">
              <p className="method-label">Powered by</p>
              <p className="method-value">OpenAI Vision API</p>
            </div>
          </div>
          
          {/* Enhanced Metrics Display */}
          {enhancedMetrics && renderEnhancedMetrics()}
          
          {/* Enhanced Results Display */}
          <EnhancedResultsDisplay results={results} />
          
          {/* Include footer info sections from original component */}
          <div className="info-section">
            <h3 className="section-subtitle">How This Works</h3>
            <p className="info-text">
              This analyzer uses OpenAI's Vision API to identify roofing shingle characteristics. 
              The AI examines visual patterns, textures, and colors to determine material type, 
              manufacturer, and specifications. Results are derived directly from AI analysis of 
              your uploaded image.
            </p>
          </div>
          
          <div className="info-section">
            <h3 className="section-subtitle">Additional Information</h3>
            <p className="info-text">
              This analysis is based on visual characteristics of the shingle. For precise 
              specifications, please consult the manufacturer's documentation or contact a 
              roofing professional. Results may vary based on image quality and lighting conditions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedShingleAnalyzer;
