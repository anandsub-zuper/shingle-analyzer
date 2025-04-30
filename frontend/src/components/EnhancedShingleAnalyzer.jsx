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

  // Extract structured data from API response
  const extractStructuredData = (apiResponse) => {
    try {
      // If already processed
      if (apiResponse.specifications) {
        return apiResponse.specifications;
      }
      
      // Extract from raw API response
      if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
        const content = apiResponse.choices[0].message.content;
        
        // Look for JSON in content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        
        // Try to parse whole content as JSON
        try {
          return JSON.parse(content);
        } catch (e) {
          console.warn("Could not parse content as JSON", e);
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting structured data:", error);
      return null;
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
            // Store raw API response
            setResults(data);
            
            // Extract structured data
            const structuredData = extractStructuredData(data);
            
            if (structuredData) {
              // Calculate enhanced metrics
              calculateEnhancedMetrics(structuredData);
            } else {
              console.warn("Could not extract structured data from API response");
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
      
      // Extract main sections with support for both naming conventions
      const materialSpecification = analysisData['MATERIAL SPECIFICATION'] || analysisData.materialSpecification || {};
      const damageAssessment = analysisData['DAMAGE ASSESSMENT'] || analysisData.damageAssessment || {};
      
      // Calculate total damage percentage
      let totalDamagePercentage = 0;
      const damageTypes = [
        'granuleLoss',
        'cracking',
        'curling',
        'blistering',
        'missingShingles',
        'hailDamage',
        'waterDamage',
        'algaeGrowth'
      ];
      
      for (const type of damageTypes) {
        if (damageAssessment[type] && damageAssessment[type].present) {
          let coverage = damageAssessment[type].coverage;
          
          // Handle coverage as either number or string percentage
          if (typeof coverage === 'string') {
            const match = coverage.match(/(\d+)/);
            if (match) {
              coverage = parseInt(match[1], 10);
            } else {
              coverage = 0;
            }
          }
          
          totalDamagePercentage += coverage || 0;
        }
      }
      
      // Apply overlap adjustment (assuming 15% overlap between damage types)
      if (totalDamagePercentage > 0) {
        const damageTypesCount = damageTypes.filter(type => 
          damageAssessment[type] && damageAssessment[type].present
        ).length;
        
        if (damageTypesCount > 1) {
          const overlapAdjustment = (damageTypesCount - 1) * 0.15;
          totalDamagePercentage = Math.min(100, totalDamagePercentage * (1 - overlapAdjustment));
        }
      }
      
      // Calculate remaining roof life
      let remainingLifeYears = "Unknown";
      let remainingLifePercentage = 100;
      
      // Extract lifespan
      let lifespan = 0;
      if (materialSpecification.lifespan) {
        const match = materialSpecification.lifespan.match(/(\d+)/);
        if (match) {
          lifespan = parseInt(match[1], 10);
          if (materialSpecification.lifespan.includes('-')) {
            // Handle range format (e.g., "20-25 years")
            const range = materialSpecification.lifespan.match(/(\d+)-(\d+)/);
            if (range && range.length >= 3) {
              lifespan = (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
            }
          }
        }
      }
      
      // Default lifespan based on material if not specified
      if (!lifespan) {
        const material = (materialSpecification.material || '').toLowerCase();
        if (material.includes('asphalt')) {
          lifespan = materialSpecification.materialSubtype?.toLowerCase().includes('architectural') ? 30 : 20;
        } else if (material.includes('metal')) {
          lifespan = 50;
        } else if (material.includes('wood')) {
          lifespan = 25;
        } else if (material.includes('clay') || material.includes('slate')) {
          lifespan = 75;
        } else {
          lifespan = 25; // Default
        }
      }
      
      // Extract age
      let age = 0;
      if (materialSpecification.estimatedAge) {
        const match = materialSpecification.estimatedAge.match(/(\d+)/);
        if (match) {
          age = parseInt(match[1], 10);
          if (materialSpecification.estimatedAge.includes('-')) {
            // Handle range format (e.g., "5-7 years")
            const range = materialSpecification.estimatedAge.match(/(\d+)-(\d+)/);
            if (range && range.length >= 3) {
              age = (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
            }
          }
        }
      }
      
      // Calculate remaining life
      if (lifespan > 0) {
        // Base calculation
        let remainingYears = Math.max(0, lifespan - age);
        
        // Adjust for damage severity
        const severity = damageAssessment.damageSeverity || 0;
        let damageMultiplier = 1;
        
        if (severity >= 8) {
          damageMultiplier = 0.3; // 70% reduction
        } else if (severity >= 6) {
          damageMultiplier = 0.6; // 40% reduction
        } else if (severity >= 4) {
          damageMultiplier = 0.8; // 20% reduction
        } else if (severity >= 2) {
          damageMultiplier = 0.9; // 10% reduction
        }
        
        remainingYears = Math.round(remainingYears * damageMultiplier);
        remainingLifePercentage = Math.round((remainingYears / lifespan) * 100);
        remainingLifeYears = remainingYears > 0 ? `${remainingYears} years` : 'Less than 1 year';
      }
      
      // Determine repair priority
      let repairPriority = "Unknown";
      const severity = damageAssessment.damageSeverity || 0;
      const structuralConcerns = damageAssessment.structuralConcerns || false;
      const progressiveIssues = damageAssessment.progressiveIssues || false;
      const waterDamage = damageAssessment.waterDamage?.present || false;
      
      if (structuralConcerns) {
        repairPriority = "Immediate - Structural concerns present";
      } else if (waterDamage && progressiveIssues) {
        repairPriority = "High - Water damage with progressive deterioration";
      } else if (severity >= 8) {
        repairPriority = "Urgent - Severe damage requiring prompt attention";
      } else if (severity >= 6) {
        repairPriority = "High - Significant damage requiring timely repairs";
      } else if (severity >= 4) {
        repairPriority = "Moderate - Address within 3-6 months";
      } else if (severity >= 2) {
        repairPriority = "Low - Monitor and address during routine maintenance";
      } else {
        repairPriority = "None - No significant issues detected";
      }
      
      // Extract or estimate costs
      const repairAssessment = analysisData['REPAIR ASSESSMENT'] || analysisData.repairAssessment || {};
      const repairCost = repairAssessment.anticipatedRepairCost || "$0 - $0";
      const replacementCost = repairAssessment.anticipatedReplacementCost || "$0 - $0";
      
      // Get recommendation
      let recommendation = repairAssessment.repairRecommendation || "Monitor";
      let reasoning = "Based on the analysis of the roof condition.";
      
      if (severity <= 2 && totalDamagePercentage < 5) {
        recommendation = "Monitor";
        reasoning = "Minor damage detected. Monitor the condition and address any changes during routine maintenance.";
      } else if (severity >= 7 || totalDamagePercentage > 35 || remainingLifePercentage < 25) {
        recommendation = "Replace";
        reasoning = "Significant damage detected or limited remaining lifespan. Replacement is recommended for long-term value.";
      } else if (severity >= 4 || totalDamagePercentage > 15) {
        recommendation = "Repair";
        reasoning = "Moderate damage detected. Repairs are recommended to prevent further deterioration.";
      }
      
      // Set enhanced metrics
      setEnhancedMetrics({
        totalDamagePercentage: Math.round(totalDamagePercentage),
        remainingLife: {
          years: remainingLifeYears,
          percentage: Math.min(100, Math.max(0, remainingLifePercentage))
        },
        repairPriority,
        costEstimates: {
          repair: repairCost,
          replacement: replacementCost
        },
        repairOrReplace: {
          recommendation,
          reasoning
        }
      });
    } catch (error) {
      console.error("Error calculating enhanced metrics:", error);
      // Provide default metrics in case of error
      setEnhancedMetrics({
        totalDamagePercentage: 0,
        remainingLife: {
          years: "Unknown",
          percentage: 100
        },
        repairPriority: "Unknown",
        costEstimates: {
          repair: "$0 - $0",
          replacement: "$0 - $0"
        },
        repairOrReplace: {
          recommendation: "Unknown",
          reasoning: "Could not determine recommendation due to processing error."
        }
      });
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
              <h2 className="shingle-name">Analyzed Shingle</h2>
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
