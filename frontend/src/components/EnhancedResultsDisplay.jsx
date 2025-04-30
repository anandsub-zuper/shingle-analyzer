// src/components/EnhancedResultsDisplay.jsx
import React, { useState } from 'react';
import '../styles/EnhancedResultsDisplay.css';

const EnhancedResultsDisplay = ({ results }) => {
  const [activeTab, setActiveTab] = useState('specifications');
  
  // Early return if no results
  if (!results) {
    return <div className="no-results">No analysis results available</div>;
  }
  
  // Extract data from the response
  const extractStructuredData = () => {
    try {
      // If the data has already been processed by ShingleAnalyzer component
      if (results.specifications) {
        return results.specifications;
      }
      
      // Try to parse from the OpenAI API response
      if (results.choices && results.choices[0] && results.choices[0].message) {
        const content = results.choices[0].message.content;
        
        // Try to extract JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        
        // Try to parse the whole content
        try {
          return JSON.parse(content);
        } catch (e) {
          console.warn("Unable to parse content as JSON");
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting data:", error);
      return null;
    }
  };
  
  const data = extractStructuredData();
  
  // If we couldn't extract structured data
  if (!data) {
    return (
      <div className="error-parsing">
        <h3>Error Parsing Results</h3>
        <p>There was a problem interpreting the analysis results.</p>
        <pre>{JSON.stringify(results, null, 2)}</pre>
      </div>
    );
  }
  
  // Helper function to safely access nested properties
  const get = (obj, path, defaultValue = 'Unknown') => {
    const keys = Array.isArray(path) ? path : path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result !== null && result !== undefined ? result : defaultValue;
  };
  
  // Extract each section of data
  const materialSpec = data['MATERIAL SPECIFICATION'] || data.materialSpecification || {};
  const damageAssessment = data['DAMAGE ASSESSMENT'] || data.damageAssessment || {};
  const repairAssessment = data['REPAIR ASSESSMENT'] || data.repairAssessment || {};
  const metadata = data['METADATA'] || data.metadata || {};
  
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

  // Render functions for each tab
  const renderSpecifications = () => {
    // Handle manufacturer as string or array
    let manufacturerValue = materialSpec.manufacturer;
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
          <h3 className="material-name">{materialSpec.name || "Unknown Material"}</h3>
          {manufacturerValue && (
            <div className="manufacturer">
              <span className="manufacturer-label">Manufacturer:</span>
              <span className="manufacturer-value">{manufacturerValue}</span>
            </div>
          )}
          {materialSpec.productLine && (
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
            <span className="spec-value">{materialSpec.material || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Material Subtype</span>
            <span className="spec-value">{materialSpec.materialSubtype || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Dimensions</span>
            <span className="spec-value">{materialSpec.dimensions || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Thickness</span>
            <span className="spec-value">{materialSpec.thickness || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Weight</span>
            <span className="spec-value">{materialSpec.weight || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Pattern</span>
            <span className="spec-value">{materialSpec.pattern || "Unknown"}</span>
          </div>
          
          {/* Age & Lifespan */}
          <div className="spec-item">
            <span className="spec-label">Estimated Age</span>
            <span className="spec-value">{materialSpec.estimatedAge || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Expected Lifespan</span>
            <span className="spec-value">{materialSpec.lifespan || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Warranty</span>
            <span className="spec-value">{materialSpec.warranty || "Unknown"}</span>
          </div>
          
          {/* Performance Ratings */}
          <div className="spec-item">
            <span className="spec-label">Fire Rating</span>
            <span className="spec-value">{materialSpec.fireRating || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Wind Rating</span>
            <span className="spec-value">{materialSpec.windRating || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Impact Resistance</span>
            <span className="spec-value">{materialSpec.impactResistance || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Energy Efficiency</span>
            <span className="spec-value">{materialSpec.energyEfficiency || "Unknown"}</span>
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

  const renderDamageAssessment = () => {
    // Parse damage types
    let damageTypes = damageAssessment.damageTypes || [];
    if (!Array.isArray(damageTypes)) {
      damageTypes = [damageTypes];
    }
    
    return (
      <div className="damage-assessment-container">
        <div className="damage-summary">
          <div className={`condition-indicator condition-${(damageAssessment.overallCondition || "").toLowerCase()}`}>
            <span className="condition-label">Condition:</span>
            <span className="condition-value">{damageAssessment.overallCondition || "Unknown"}</span>
          </div>
          
          <div className="damage-severity">
            <span className="severity-label">Overall Severity:</span>
            <div className="severity-meter">
              <div 
                className="severity-fill" 
                style={{ 
                  width: `${(damageAssessment.damageSeverity || 0) * 10}%`,
                  backgroundColor: getSeverityColor(damageAssessment.damageSeverity || 0)
                }}
              />
              <span className="severity-value">{damageAssessment.damageSeverity || 0}/10</span>
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
          {damageAssessment.likelyDamageCauses && damageAssessment.likelyDamageCauses.length > 0 && (
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

  const renderRepairAssessment = () => {
    // Parse special considerations
    let specialConsiderations = repairAssessment.specialConsiderations || [];
    if (!Array.isArray(specialConsiderations)) {
      specialConsiderations = [specialConsiderations];
    }
    
    return (
      <div className="repair-assessment-container">
        <div className="repair-summary">
          <div className={`recommendation-indicator recommendation-${(repairAssessment.repairRecommendation || "").toLowerCase().replace(/\s+/g, '-')}`}>
            <span className="recommendation-label">Recommendation:</span>
            <span className="recommendation-value">{repairAssessment.repairRecommendation || "Unknown"}</span>
          </div>
          
          <div className={`urgency-indicator urgency-${(repairAssessment.urgency || "").toLowerCase()}`}>
            <span className="urgency-label">Urgency:</span>
            <span className="urgency-value">{repairAssessment.urgency || "Unknown"}</span>
          </div>
        </div>
        
        <div className="repair-details">
          <div className="repair-difficulty">
            <span className="difficulty-label">Repair Difficulty:</span>
            <span className="difficulty-value">{repairAssessment.repairDifficulty || "Unknown"}</span>
          </div>
          
          <div className="diy-feasibility">
            <span className="diy-label">DIY Feasible:</span>
            <span className="diy-value">{repairAssessment.diyFeasibility ? "Yes" : "No"}</span>
          </div>
          
          <div className="cost-estimates">
            <div className="cost-item repair-cost">
              <span className="cost-label">Estimated Repair Cost:</span>
              <span className="cost-value">{repairAssessment.anticipatedRepairCost || "Unknown"}</span>
            </div>
            
            <div className="cost-item replacement-cost">
              <span className="cost-label">Estimated Replacement Cost:</span>
              <span className="cost-value">{repairAssessment.anticipatedReplacementCost || "Unknown"}</span>
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

  const renderMetadata = () => {
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
              style={{ width: `${(metadata.confidenceScore || 0) * 10}%` }}
            />
            <span className="confidence-value">{metadata.confidenceScore || 0}/10</span>
          </div>
        </div>
        
        <div className="visibility-section">
          <h4>Image Visibility</h4>
          <div className="visibility-item">
            <span className="visibility-label">Visibility Quality:</span>
            <span className="visibility-value">{metadata.visibilityQuality || "Unknown"}</span>
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

  const renderRawData = () => {
    return (
      <div className="raw-data-container">
        <h3>Raw Analysis Data</h3>
        <div className="raw-data-code">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    );
  };

  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    if (severity <= 3) return 'var(--success)';
    if (severity <= 6) return 'var(--warning)';
    if (severity <= 8) return '#FF9800'; // Orange
    return 'var(--danger)';
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
          onClick={() => setActiveTab('raw')}
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
