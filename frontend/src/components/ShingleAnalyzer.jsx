// src/components/ShingleAnalyzer.jsx
import { useState } from 'react';
import '../styles/ShingleAnalyzer.css';
import DamageAssessment from './DamageAssessment';
import CostEstimation from './CostEstimation';

const ShingleAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

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
    }
  };

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
        const base64Image = reader.result.split(',')[1];
        
        try {
          // Call your backend API - replace with your actual Heroku URL
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
              const gptResponse = data.choices[0].message.content;
              
              try {
                // Try to parse the response as JSON
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
                  // If any essential fields are missing, add placeholder values
                  const requiredFields = ['name', 'manufacturer', 'productLine', 'material', 'weight', 
                                        'dimensions', 'thickness', 'lifespan', 'pattern', 'warranty'];
                  
                  requiredFields.forEach(field => {
                    if (!parsedResponse[field]) {
                      parsedResponse[field] = 'Unknown';
                    }
                  });
                  
                  // Initialize damageAssessment if it doesn't exist
                  if (!parsedResponse.damageAssessment) {
                    parsedResponse.damageAssessment = {
                      overallCondition: 'Unknown',
                      damageTypes: [],
                      severity: 0,
                      description: 'No damage assessment available',
                      recommendedAction: 'Consider a professional inspection for accurate assessment'
                    };
                  }
                  
                  setResults({
                    specifications: parsedResponse,
                    rawResponse: typeof gptResponse === 'string' ? gptResponse : JSON.stringify(gptResponse, null, 2)
                  });
                } else {
                  throw new Error("Could not parse response as JSON");
                }
              } catch (e) {
                // Extract useful info from text response by creating a simplified JSON
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
                
                const simplifiedResponse = {
                  name: name,
                  manufacturer: manufacturer,
                  productLine: "Unknown",
                  material: "Unknown Material",
                  weight: "Unknown",
                  dimensions: "Unknown",
                  thickness: "Unknown",
                  lifespan: "Unknown",
                  pattern: "Unknown",
                  warranty: "Unknown",
                  damageAssessment: {
                    overallCondition: 'Unknown',
                    damageTypes: [],
                    severity: 0,
                    description: 'Unable to assess damage from the provided image',
                    recommendedAction: 'Consider a professional inspection'
                  },
                  details: typeof gptResponse === 'string' ? gptResponse : "No text response available"
                };
                
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

  return (
    <div className="shingle-analyzer-container">
      <h1 className="analyzer-title">Roofing Shingle Analyzer</h1>
      
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
              <h2 className="shingle-name">{results.specifications.name}</h2>
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
          
          <div className="specs-section">
            <h3 className="section-subtitle">Specifications</h3>
            <div className="specifications-grid">
              <div className="spec-item">
                <span className="spec-label">Manufacturer</span>
                <span className="spec-value">{results.specifications.manufacturer}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Product Line</span>
                <span className="spec-value">{results.specifications.productLine}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Material</span>
                <span className="spec-value">{results.specifications.material}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Weight</span>
                <span className="spec-value">{results.specifications.weight}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Dimensions</span>
                <span className="spec-value">{results.specifications.dimensions}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Thickness</span>
                <span className="spec-value">{results.specifications.thickness}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Expected Lifespan</span>
                <span className="spec-value">{results.specifications.lifespan}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Pattern Type</span>
                <span className="spec-value">{results.specifications.pattern}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Warranty</span>
                <span className="spec-value">{results.specifications.warranty}</span>
              </div>
            </div>
          </div>
          
          {/* Add the damage assessment section */}
          {results.specifications.damageAssessment && (
            <DamageAssessment damageData={results.specifications.damageAssessment} />
          )}
          
          {/* Add the cost estimation section */}
          {results.specifications.damageAssessment && (
            <CostEstimation damageData={results.specifications.damageAssessment} />
          )}
          
          {results.rawResponse && (
            <div className="raw-response">
              <h3 className="section-subtitle">Raw API Response</h3>
              <div className="code-block">
                <pre className="response-code">{results.rawResponse}</pre>
              </div>
            </div>
          )}
          
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

export default ShingleAnalyzer;
