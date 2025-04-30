// src/components/EnhancedResultsDisplay.jsx
import React, { useState, useEffect } from 'react';
import '../styles/EnhancedResultsDisplay.css';

const EnhancedResultsDisplay = ({ results }) => {
  const [activeTab, setActiveTab] = useState('specifications');
  const [parsedData, setParsedData] = useState(null);
  
  // Parse data when results change
  useEffect(() => {
    if (results) {
      const extractedData = extractStructuredData(results);
      console.log("Extracted data:", extractedData);
      setParsedData(extractedData);
    }
  }, [results]);
  
  // Early return if no results
  if (!results) {
    return <div className="no-results">No analysis results available</div>;
  }
  
  // Early return if parsing failed
  if (!parsedData) {
    return (
      <div className="error-parsing">
        <h3>Processing Results</h3>
        <p>The analysis is still being processed or couldn't be parsed.</p>
        <p>Here's the beginning of the response we received:</p>
        <pre className="response-sample">
          {results && results.choices && results.choices[0] && results.choices[0].message 
            ? results.choices[0].message.content.substring(0, 200) + '...' 
            : 'No content found in response'}
        </pre>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }
  
  // Enhanced function to extract structured data from API response
  function extractStructuredData(apiResponse) {
    try {
      console.log("Extracting from API response");
      
      // First check if we already have parsed results from backend
      if (apiResponse.parsedResults) {
        console.log("Using pre-parsed results from backend");
        return apiResponse.parsedResults;
      }
      
      // Extract from raw API response
      if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
        const content = apiResponse.choices[0].message.content;
        
        // Try to parse directly if it's already an object
        if (typeof content === 'object' && content !== null) {
          console.log("Content is already an object");
          return normalizeDataStructure(content);
        }
        
        // If content is not a string, can't process further
        if (typeof content !== 'string') {
          console.error("Content is not a string:", content);
          return null;
        }
        
        // Try multiple extraction methods
        
        // Method 1: Look for JSON code block
        if (content.includes('```json')) {
          console.log("Found JSON code block, attempting to extract");
          const jsonMatch = content.match(/```json\s*([\s\S]*?)(\s*```|$)/);
          
          if (jsonMatch && jsonMatch[1]) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              console.log("Successfully parsed JSON from code block");
              return normalizeDataStructure(parsed);
            } catch (e) {
              console.error("Failed to parse JSON from code block:", e);
              // Continue to other methods
            }
          }
        }
        
        // Method 2: Look for direct JSON object in content
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log("Successfully parsed direct JSON in content");
            return normalizeDataStructure(parsed);
          }
        } catch (e) {
          console.error("Failed to parse direct JSON:", e);
          // Continue to other methods
        }
        
        // Method 3: Use a more flexible extraction approach
        // Find the largest JSON-like structure in the content
        let maxOpenBraces = 0;
        let currentOpenBraces = 0;
        let potentialStart = -1;
        let potentialEnd = -1;
        
        for (let i = 0; i < content.length; i++) {
          if (content[i] === '{') {
            if (currentOpenBraces === 0) {
              potentialStart = i;
            }
            currentOpenBraces++;
            maxOpenBraces = Math.max(maxOpenBraces, currentOpenBraces);
          } else if (content[i] === '}') {
            currentOpenBraces--;
            if (currentOpenBraces === 0 && potentialStart !== -1) {
              potentialEnd = i;
              // Try to parse this potential JSON object
              try {
                const jsonSubstring = content.substring(potentialStart, potentialEnd + 1);
                const parsed = JSON.parse(jsonSubstring);
                console.log("Successfully parsed JSON using flexible extraction");
                return normalizeDataStructure(parsed);
              } catch (e) {
                // Continue looking
                console.log("Failed to parse potential JSON section, continuing search");
              }
            }
          }
        }
        
        // Method 4: Attempt to extract structured data even from non-JSON format
        // Look for key sections that might be in the content
        console.log("Attempting to extract structured data from text content");
        const extractedData = {
          materialSpecification: {},
          damageAssessment: {},
          repairAssessment: {},
          metadata: {}
        };
        
        // Try to extract basic material info
        const materialNameMatch = content.match(/Material:[\s\n]*(.*?)[\s\n]*(\.|$)/i);
        if (materialNameMatch) {
          extractedData.materialSpecification.name = materialNameMatch[1].trim();
        }
        
        const manufacturerMatch = content.match(/Manufacturer:[\s\n]*(.*?)[\s\n]*(\.|$)/i);
        if (manufacturerMatch) {
          extractedData.materialSpecification.manufacturer = manufacturerMatch[1].trim();
        }
        
        // Try to extract condition
        const conditionMatch = content.match(/Condition:[\s\n]*(Excellent|Good|Fair|Poor|Critical)[\s\n]*(\.|$)/i);
        if (conditionMatch) {
          extractedData.damageAssessment.overallCondition = conditionMatch[1].trim();
        }
        
        // If we have at least some structured data, return it
        if (extractedData.materialSpecification.name || extractedData.damageAssessment.overallCondition) {
          console.log("Created structured data from text content");
          return extractedData;
        }
      }
      
      // If we reach here, we couldn't extract structured data
      console.error("Could not extract structured data from API response");
      return {
        materialSpecification: { name: "Unknown" },
        damageAssessment: { overallCondition: "Unknown" },
        repairAssessment: {},
        metadata: {}
      };
    } catch (error) {
      console.error("Error in extractStructuredData:", error);
      return {
        materialSpecification: { name: "Unknown" },
        damageAssessment: { overallCondition: "Unknown" },
        repairAssessment: {},
        metadata: {}
      };
    }
  }
  
  // Helper function to normalize the data structure
  function normalizeDataStructure(data) {
    // Create a standardized structure regardless of case/format
    return {
      materialSpecification: data["MATERIAL SPECIFICATION"] || 
                             data["materialSpecification"] || 
                             data["material_specification"] || 
                             {},
      damageAssessment: data["DAMAGE ASSESSMENT"] || 
                        data["damageAssessment"] || 
                        data["damage_assessment"] || 
                        {},
      repairAssessment: data["REPAIR ASSESSMENT"] || 
                        data["repairAssessment"] || 
                        data["repair_assessment"] || 
                        {},
      metadata: data["METADATA"] || 
                data["metadata"] || 
                {}
    };
  }
  
  // Helper function to safely access nested properties
  const safeGet = (obj, path, defaultValue = "Unknown") => {
    try {
      const result = path.split('.').reduce((o, p) => o?.[p], obj);
      return result !== undefined && result !== null ? result : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };
  
  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    if (severity <= 3) return 'var(--success)';
    if (severity <= 6) return 'var(--warning)';
    if (severity <= 8) return '#FF9800'; // Orange
    return 'var(--danger)';
  };

  // Render specifications tab
  const renderSpecifications = () => {
    const materialSpec = parsedData.materialSpecification || {};
    console.log("Material specs:", materialSpec);
    
    // Handle manufacturer as string or array
    let manufacturerValue = materialSpec.manufacturer || "Unknown";
    if (Array.isArray(manufacturerValue)) {
      manufacturerValue = manufacturerValue.join(', ');
    }
    
    // Handle colors as string or array
    let colorsArray = materialSpec.colors || [];
    if (!Array.isArray(colorsArray)) {
      colorsArray = [colorsArray];
    }
    
    return (
      <div className="specifications-container">
        <div className="material-overview">
          <h3 className="material-name">{safeGet(materialSpec, 'name')}</h3>
          {manufacturerValue && manufacturerValue !== "Unknown" && (
            <div className="manufacturer">
              <span className="manufacturer-label">Manufacturer:</span>
              <span className="manufacturer-value">{manufacturerValue}</span>
            </div>
          )}
          {materialSpec.productLine && materialSpec.productLine !== "Unknown" && (
            <div className="product-line">
              <span className="product-line-label">Product Line:</span>
              <span className="product-line-value">{materialSpec.productLine}</span>
            </div>
          )}
        </div>
        
        <div className="specifications-grid">
          {/* Material Details */}
          <div className="spec-item">
            <span className="spec-label">Material Type</span>
            <span className="spec-value">{safeGet(materialSpec, 'material')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Material Subtype</span>
            <span className="spec-value">{safeGet(materialSpec, 'materialSubtype')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Dimensions</span>
            <span className="spec-value">{safeGet(materialSpec, 'dimensions')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Thickness</span>
            <span className="spec-value">{safeGet(materialSpec, 'thickness')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Weight</span>
            <span className="spec-value">{safeGet(materialSpec, 'weight')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Pattern</span>
            <span className="spec-value">{safeGet(materialSpec, 'pattern')}</span>
          </div>
          
          {/* Age & Lifespan */}
          <div className="spec-item">
            <span className="spec-label">Estimated Age</span>
            <span className="spec-value">{safeGet(materialSpec, 'estimatedAge')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Expected Lifespan</span>
            <span className="spec-value">{safeGet(materialSpec, 'lifespan')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Warranty</span>
            <span className="spec-value">{safeGet(materialSpec, 'warranty')}</span>
          </div>
          
          {/* Performance Ratings */}
          <div className="spec-item">
            <span className="spec-label">Fire Rating</span>
            <span className="spec-value">{safeGet(materialSpec, 'fireRating')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Wind Rating</span>
            <span className="spec-value">{safeGet(materialSpec, 'windRating')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Impact Resistance</span>
            <span className="spec-value">{safeGet(materialSpec, 'impactResistance')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Energy Efficiency</span>
            <span className="spec-value">{safeGet(materialSpec, 'energyEfficiency')}</span>
          </div>
          
          {/* Colors */}
          {colorsArray && colorsArray.length > 0 && (
            <div className="spec-item colors-item">
              <span className="spec-label">Colors</span>
              <div className="colors-container">
                {colorsArray.map((color, index) => (
                  <span key={index} className="color-tag">{color}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Helper function to render damage type details
  const renderDamageType = (type, data) => {
    if (!data || !data.present) return null;
    
    // Parse coverage from string to number if needed
    let coverageValue = data.coverage;
    if (typeof coverageValue === 'string') {
      const match = coverageValue.match(/(\d+)/);
      if (match) {
        coverageValue = parseInt(match[1], 10);
      } else {
        coverageValue = 0;
      }
    }
    
    return (
      <div className={`damage-type-item ${data.severity > 5 ? 'severe' : 'moderate'}`}>
        <div className="damage-type-header">
          <h4>{type}</h4>
          <div className="severity-badge">
            Severity: {data.severity}/10
          </div>
        </div>
        <p className="damage-description">{data.description}</p>
        <div className="damage-coverage">
          <div className="coverage-label">Coverage:</div>
          <div className="coverage-bar-container">
            <div 
              className="coverage-bar" 
              style={{ width: `${coverageValue}%` }}
            />
            <div className="coverage-percentage">{coverageValue}%</div>
          </div>
        </div>
      </div>
    );
  };

  // Render damage assessment tab
  const renderDamageAssessment = () => {
    const damageAssessment = parsedData.damageAssessment || {};
    console.log("Damage assessment:", damageAssessment);
    
    // Parse damage types
    let damageTypes = damageAssessment.damageTypes || [];
    if (!Array.isArray(damageTypes)) {
      damageTypes = [damageTypes];
    }
    
    return (
      <div className="damage-assessment-container">
        <div className="damage-summary">
          <div className={`condition-indicator condition-${(safeGet(damageAssessment, 'overallCondition') || "").toLowerCase()}`}>
            <span className="condition-label">Condition:</span>
            <span className="condition-value">{safeGet(damageAssessment, 'overallCondition')}</span>
          </div>
          
          <div className="damage-severity">
            <span className="severity-label">Overall Severity:</span>
            <div className="severity-meter">
              <div 
                className="severity-fill" 
                style={{ 
                  width: `${(safeGet(damageAssessment, 'damageSeverity', 0) * 10)}%`,
                  backgroundColor: getSeverityColor(safeGet(damageAssessment, 'damageSeverity', 0))
                }}
              />
              <span className="severity-value">{safeGet(damageAssessment, 'damageSeverity', 0)}/10</span>
            </div>
          </div>
          
          {damageTypes.length > 0 && (
            <div className="damage-types-overview">
              <span className="damage-types-label">Detected Issues:</span>
              <div className="damage-types-tags">
                {damageTypes.map((type, index) => (
                  <span key={index} className="damage-type-tag">{type}</span>
                ))}
              </div>
            </div>
          )}
          
          {damageAssessment.description && (
            <div className="damage-description-overview">
              <p>{damageAssessment.description}</p>
            </div>
          )}
        </div>
        
        <div className="damage-details">
          <h3 className="damage-details-title">Detailed Damage Assessment</h3>
          
          {renderDamageType("Granule Loss", damageAssessment.granuleLoss)}
          {renderDamageType("Cracking", damageAssessment.cracking)}
          {renderDamageType("Curling", damageAssessment.curling)}
          {renderDamageType("Blistering", damageAssessment.blistering)}
          {renderDamageType("Missing Shingles", damageAssessment.missingShingles)}
          {renderDamageType("Hail Damage", damageAssessment.hailDamage)}
          {renderDamageType("Water Damage", damageAssessment.waterDamage)}
          {renderDamageType("Algae Growth", damageAssessment.algaeGrowth)}
          
          {/* Show additional metadata if available */}
          {damageAssessment.likelyDamageCauses && (
            <div className="damage-causes">
              <h4>Likely Causes:</h4>
              <div className="causes-container">
                {Array.isArray(damageAssessment.likelyDamageCauses) ? 
                  damageAssessment.likelyDamageCauses.map((cause, index) => (
                    <span key={index} className="cause-tag">{cause}</span>
                  )) :
                  <span className="cause-tag">{damageAssessment.likelyDamageCauses}</span>
                }
              </div>
            </div>
          )}
          
          {damageAssessment.estimatedTimeframeSinceDamage && (
            <div className="damage-timeframe">
              <span className="timeframe-label">Estimated Time Since Damage:</span>
              <span className="timeframe-value">{damageAssessment.estimatedTimeframeSinceDamage}</span>
            </div>
          )}
          
          {/* Additional flags */}
          <div className="damage-flags">
            {damageAssessment.weatherRelated && (
              <div className="flag-item weather-related">
                <span className="flag-icon">🌧️</span>
                <span className="flag-text">Weather-Related Damage</span>
              </div>
            )}
            
            {damageAssessment.structuralConcerns && (
              <div className="flag-item structural-concerns">
                <span className="flag-icon">⚠️</span>
                <span className="flag-text">Structural Concerns Present</span>
              </div>
            )}
            
            {damageAssessment.progressiveIssues && (
              <div className="flag-item progressive-issues">
                <span className="flag-icon">📈</span>
                <span className="flag-text">Progressive Damage (Will Worsen)</span>
              </div>
            )}
          </div>
          
          {damageAssessment.recommendedAction && (
            <div className="recommended-action">
              <h4>Recommended Action:</h4>
              <p>{damageAssessment.recommendedAction}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render repair assessment tab
  const renderRepairAssessment = () => {
    const repairAssessment = parsedData.repairAssessment || {};
    console.log("Repair assessment:", repairAssessment);
    
    // Parse special considerations
    let specialConsiderations = repairAssessment.specialConsiderations || [];
    if (!Array.isArray(specialConsiderations)) {
      specialConsiderations = [specialConsiderations];
    }
    
    return (
      <div className="repair-assessment-container">
        <div className="repair-summary">
          <div className={`recommendation-indicator recommendation-${(safeGet(repairAssessment, 'repairRecommendation', "")).toLowerCase().replace(/\s+/g, '-')}`}>
            <span className="recommendation-label">Recommendation:</span>
            <span className="recommendation-value">{safeGet(repairAssessment, 'repairRecommendation')}</span>
          </div>
          
          <div className={`urgency-indicator urgency-${(safeGet(repairAssessment, 'urgency', "")).toLowerCase()}`}>
            <span className="urgency-label">Urgency:</span>
            <span className="urgency-value">{safeGet(repairAssessment, 'urgency')}</span>
          </div>
        </div>
        
        <div className="repair-details">
          <div className="repair-difficulty">
            <span className="difficulty-label">Repair Difficulty:</span>
            <span className="difficulty-value">{safeGet(repairAssessment, 'repairDifficulty')}</span>
          </div>
          
          <div className="diy-feasibility">
            <span className="diy-label">DIY Feasible:</span>
            <span className="diy-value">{repairAssessment.diyFeasibility ? "Yes" : "No"}</span>
          </div>
          
          <div className="cost-estimates">
            <div className="cost-item repair-cost">
              <span className="cost-label">Estimated Repair Cost:</span>
              <span className="cost-value">{safeGet(repairAssessment, 'anticipatedRepairCost')}</span>
            </div>
            
            <div className="cost-item replacement-cost">
              <span className="cost-label">Estimated Replacement Cost:</span>
              <span className="cost-value">{safeGet(repairAssessment, 'anticipatedReplacementCost')}</span>
            </div>
          </div>
          
          {specialConsiderations.length > 0 && (
            <div className="special-considerations">
              <h4>Special Considerations:</h4>
              <ul className="considerations-list">
                {specialConsiderations.map((consideration, index) => (
                  <li key={index} className="consideration-item">{consideration}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render metadata tab
  const renderMetadata = () => {
    const metadata = parsedData.metadata || {};
    console.log("Metadata:", metadata);
    
    // Parse visibility estimate
    let visibleSection = metadata.visibleSectionEstimate || "0%";
    if (typeof visibleSection === 'number') {
      visibleSection = `${visibleSection}%`;
    }
    
    return (
      <div className="metadata-container">
        <div className="confidence-section">
          <h4>Analysis Confidence</h4>
          <div className="confidence-meter">
            <div 
              className="confidence-fill" 
              style={{ width: `${(safeGet(metadata, 'confidenceScore', 0) * 10)}%` }}
            />
            <span className="confidence-value">{safeGet(metadata, 'confidenceScore', 0)}/10</span>
          </div>
        </div>
        
        <div className="visibility-section">
          <h4>Image Visibility</h4>
          <div className="visibility-item">
            <span className="visibility-label">Visibility Quality:</span>
            <span className="visibility-value">{safeGet(metadata, 'visibilityQuality')}</span>
          </div>
          
          <div className="visibility-item">
            <span className="visibility-label">Visible Roof Portion:</span>
            <span className="visibility-value">{visibleSection}</span>
          </div>
          
          {metadata.limitationNotes && (
            <div className="limitation-notes">
              <h4>Limitations:</h4>
              <p>{metadata.limitationNotes}</p>
            </div>
          )}
          
          {metadata.additionalInspectionNeeded && (
            <div className="additional-inspection">
              <div className="inspection-icon">📋</div>
              <div className="inspection-text">
                Additional professional inspection recommended
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render raw data tab
  const renderRawData = () => {
    return (
      <div className="raw-data-container">
        <h3>Raw Analysis Data</h3>
        <div className="raw-data-code">
          <pre>{JSON.stringify(parsedData, null, 2)}</pre>
        </div>
        <div className="raw-data-code">
          <h4>Original API Response:</h4>
          <pre>{JSON.stringify(results, null, 2).substring(0, 2000)}...</pre>
        </div>
      </div>
    );
  };

  // Add a debug function that can be called to see current state during development
  const debugData = () => {
    console.log("======== DEBUG DATA ========");
    console.log("Raw results:", results);
    console.log("Parsed data:", parsedData);
    console.log("Material spec:", parsedData?.materialSpecification);
    console.log("Damage assessment:", parsedData?.damageAssessment);
    console.log("===========================");
  };

  return (
    <div className="enhanced-results-container">
      <div className="results-tabs">
        <button 
          className={`tab-button ${activeTab === 'specifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('specifications')}
        >
          Specifications
        </button>
        <button 
          className={`tab-button ${activeTab === 'damage' ? 'active' : ''}`}
          onClick={() => setActiveTab('damage')}
        >
          Damage Assessment
        </button>
        <button 
          className={`tab-button ${activeTab === 'repair' ? 'active' : ''}`}
          onClick={() => setActiveTab('repair')}
        >
          Repair Assessment
        </button>
        <button 
          className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Analysis Details
        </button>
        <button 
          className={`tab-button ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('raw');
            debugData(); // Call debug function when viewing raw data
          }}
        >
          Raw Data
        </button>
      </div>
      
      <div className="results-content">
        {activeTab === 'specifications' && renderSpecifications()}
        {activeTab === 'damage' && renderDamageAssessment()}
        {activeTab === 'repair' && renderRepairAssessment()}
        {activeTab === 'metadata' && renderMetadata()}
        {activeTab === 'raw' && renderRawData()}
      </div>
    </div>
  );
};

export default EnhancedResultsDisplay;
