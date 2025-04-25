// src/components/ShingleAnalyzer.jsx
import { useState } from 'react';
import '../styles/ShingleAnalyzer.css';

const ShingleAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
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

    if (!apiKey) {
      setError("Please enter your OpenAI API key");
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
          // Call your backend API instead of OpenAI directly
          // Replace the URL with your actual backend server URL
          const response = await fetch('https://shingle-analyzer-cf8f8df19174.herokuapp.com/api/analyze-shingle', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image,
              apiKey: apiKey
            })
          });
          
          const data = await response.json();
          if (response.ok) {
            const gptResponse = data.choices[0].message.content;
            let parsedResponse;
            
            try {
              // Try to parse the response as JSON
              parsedResponse = JSON.parse(gptResponse);
              
              // If any essential fields are missing, add placeholder values
              const requiredFields = ['name', 'manufacturer', 'productLine', 'material', 'weight', 
                                     'dimensions', 'thickness', 'lifespan', 'pattern', 'warranty'];
              
              requiredFields.forEach(field => {
                if (!parsedResponse[field]) {
                  parsedResponse[field] = 'Unknown';
                }
              });
              
              setResults({
                specifications: parsedResponse,
                rawResponse: gptResponse
              });
            } catch (e) {
              console.error("Failed to parse GPT response as JSON:", e);
              
              // Extract useful info from text response by creating a simplified JSON
              const simplifiedResponse = {
                name: "Detected Shingle",
                manufacturer: "Unknown Manufacturer",
                productLine: "Unknown",
                material: "Unknown Material",
                weight: "Unknown",
                dimensions: "Unknown",
                thickness: "Unknown",
                lifespan: "Unknown",
                pattern: "Unknown",
                warranty: "Unknown",
                details: gptResponse
              };
              
              setResults({
                specifications: simplifiedResponse,
                rawResponse: gptResponse
              });
            }
          } else {
            throw new Error(`API error: ${data.error?.message || 'Unknown error'}`);
          }
          setAnalyzing(false);
        } catch (error) {
          console.error("API call error:", error);
          setError("Error calling API: " + error.message);
          setAnalyzing(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        setError("Error reading file: " + error.message);
        setAnalyzing(false);
      };
    } catch (err) {
      console.error("Overall error:", err);
      setError("Error analyzing image: " + err.message);
      setAnalyzing(false);
    }
  };

  return (
    <div className="shingle-analyzer-container">
      <h1 className="analyzer-title">Roofing Shingle Analyzer</h1>
      
      <div className="form-group">
        <label className="input-label">OpenAI API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your OpenAI API key"
          className="text-input"
        />
        <p className="input-help-text">
          Your API key is required to use the OpenAI Vision API for analysis
        </p>
      </div>
      
      <div className="form-group">
        <label className="input-label">Upload Shingle Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="file-input"
        />
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
        disabled={!file || analyzing || !apiKey}
        className={`analyze-button ${(!file || analyzing || !apiKey) ? 'button-disabled' : ''}`}
      >
        {analyzing ? 'Analyzing...' : 'Analyze Shingle'}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {results && (
        <div className="results-container">
          <div className="results-header">
            <div className="results-title">
              <h2 className="shingle-name">{results.specifications.name}</h2>
              <p className="analysis-completed">
                Analysis Complete
              </p>
            </div>
            <div className="analysis-method">
              <p className="method-label">Analysis Method</p>
              <p className="method-value">OpenAI Vision API</p>
            </div>
          </div>
          
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
              The API examines visual patterns, textures, and colors to determine material type, 
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
