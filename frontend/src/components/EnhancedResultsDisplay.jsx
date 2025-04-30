// src/components/EnhancedResultsDisplay.jsx
import React, { useState } from 'react';
import '../styles/EnhancedResultsDisplay.css';

const EnhancedResultsDisplay = ({ results }) => {
  const [activeTab, setActiveTab] = useState('specifications');
  
  // Early return if no results
  if (!results || !results.choices || !results.choices[0] || !results.choices[0].message) {
    return <div className="no-results">No analysis results available</div>;
  }
  
  // Extract data from the OpenAI response
  let analysisData;
  try {
    // Handle different possible response structures
    if (results.parsedResults) {
      // If the backend already parsed the JSON
      analysisData = results.parsedResults;
    } else {
      // Try to parse JSON from the content
      const content = results.choices[0].message.content;
      // Look for JSON in the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to parsing the whole content
        try {
          analysisData = JSON.parse(content);
        } catch (e) {
          // If we can't parse, create a basic structure to display the raw text
          analysisData = {
            rawText: content,
            materialSpecification: {},
            damageAssessment: { 
              damageTypes: [],
              overallCondition: "Unknown"
            },
            repairAssessment: {},
            metadata: {}
          };
        }
      }
    }
  } catch (error) {
    console.error("Error parsing results:", error);
    return (
      <div className="error-parsing">
        <h3>Error Parsing Results</h3>
        <p>There was a problem interpreting the analysis results.</p>
        <pre>{JSON.stringify(results, null, 2)}</pre>
      </div>
    );
  }

  // Helper function to render damage type details
  const renderDamageType = (type, data) => {
    if (!data || !data.present) return null;
    
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
              style={{ width: `${data.coverage}%` }}
            />
            <div className="coverage-percentage">{data.coverage}%</div>
          </div>
        </div>
      </div>
    );
  };

  // Render functions for each tab
  const renderSpecifications = () => {
    const specs = analysisData.materialSpecification || {};
    
    return (
      <div className="specifications-container">
        <div className="material-overview">
          <h3 className="material-name">{specs.name || "Unknown Material"}</h3>
          {specs.manufacturer && (
            <div className="manufacturer">
              <span className="manufacturer-label">Manufacturer:</span>
              <span className="manufacturer-value">{specs.manufacturer}</span>
            </div>
          )}
          {specs.productLine && (
            <div className="product-line">
              <span className="product-line-label">Product Line:</span>
              <span className="product-line-value">{specs.productLine}</span>
            </div>
          )}
        </div>
        
        <div className="specifications-grid">
          {/* Material Details */}
          <div className="spec-item">
            <span className="spec-label">Material Type</span>
            <span className="spec-value">{specs.material || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Material Subtype</span>
            <span className="spec-value">{specs.materialSubtype || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Dimensions</span>
            <span className="spec-value">{specs.dimensions || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Thickness</span>
            <span className="spec-value">{specs.thickness || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Weight</span>
            <span className="spec-value">{specs.weight || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Pattern</span>
            <span className="spec-value">{specs.pattern || "Unknown"}</span>
          </div>
          
          {/* Age & Lifespan */}
          <div className="spec-item">
            <span className="spec-label">Estimated Age</span>
            <span className="spec-value">{specs.estimatedAge || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Expected Lifespan</span>
            <span className="spec-value">{specs.lifespan || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Warranty</span>
            <span className="spec-value">{specs.warranty || "Unknown"}</span>
          </div>
          
          {/* Performance Ratings */}
          <div className="spec-item">
            <span className="spec-label">Fire Rating</span>
            <span className="spec-value">{specs.fireRating || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Wind Rating</span>
            <span className="spec-value">{specs.windRating || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Impact Resistance</span>
            <span className="spec-value">{specs.impactResistance || "Unknown"}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Energy Efficiency</span>
            <span className="spec-value">{specs.energyEfficiency || "Unknown"}</span>
          </div>
          
          {/* Colors */}
          {specs.colors && specs.colors.length > 0 && (
            <div className="spec-item colors-item">
              <span className="spec-label">Colors</span>
              <div className="colors-container">
                {specs.colors.map((color, index) => (
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
    const damage = analysisData.damageAssessment || {};
    
    return (
      <div className="damage-assessment-container">
        <div className="damage-summary">
          <div className={`condition-indicator condition-${(damage.overallCondition || "").toLowerCase()}`}>
            <span className="condition-label">Condition:</span>
            <span className="condition-value">{damage.overallCondition || "Unknown"}</span>
          </div>
          
          <div className="damage-severity">
            <span className="severity-label">Overall Severity:</span>
            <div className="severity-meter">
              <div 
                className="severity-fill" 
                style={{ 
                  width: `${(damage.damageSeverity || 0) * 10}%`,
                  backgroundColor: getSeverityColor(damage.damageSeverity || 0)
                }}
              />
              <span className="severity-value">{damage.damageSeverity || 0}/10</span>
            </div>
          </div>
          
          {damage.damageTypes && damage.damageTypes.length > 0 && (
            <div className="damage-types-overview">
              <span className="damage-types-label">Detected Issues:</span>
              <div className="damage-types-tags">
                {damage.damageTypes.map((type, index) => (
                  <span key={index} className="damage-type-tag">{type}</span>
                ))}
              </div>
            </div>
          )}
          
          {damage.description && (
            <div className="damage-description-overview">
              <p>{damage.description}</p>
            </div>
          )}
        </div>
        
        <div className="damage-details">
          <h3 className="damage-details-title">Detailed Damage Assessment</h3>
          
          {renderDamageType("Granule Loss", damage.granuleLoss)}
          {renderDamageType("Cracking", damage.cracking)}
          {renderDamageType("Curling", damage.curling)}
          {renderDamageType("Blistering", damage.blistering)}
          {renderDamageType("Missing Shingles", damage.missingShingles)}
          {renderDamageType("Hail Damage", damage.hailDamage)}
          {renderDamageType("Water Damage", damage.waterDamage)}
          {renderDamageType("Algae Growth", damage.algaeGrowth)}
          
          {/* Show additional metadata if available */}
          {damage.likelyDamageCauses && damage.likelyDamageCauses.length > 0 && (
            <div className="damage-causes">
              <h4>Likely Causes:</h4>
              <div className="causes-container">
                {damage.likelyDamageCauses.map((cause, index) => (
                  <span key={index} className="cause-tag">{cause}</span>
                ))}
              </div>
            </div>
          )}
          
          {damage.estimatedTimeframeSinceDamage && (
            <div className="damage-timeframe">
              <span className="timeframe-label">Estimated Time Since Damage:</span>
              <span className="timeframe-value">{damage.estimatedTimeframeSinceDamage}</span>
            </div>
          )}
          
          {/* Additional flags */}
          <div className="damage-flags">
            {damage.weatherRelated && (
              <div className="flag-item weather-related">
                <span className="flag-icon">🌧️</span>
                <span className="flag-text">Weather-Related Damage</span>
              </div>
            )}
            
            {damage.structuralConcerns && (
              <div className="flag-item structural-concerns">
                <span className="flag-icon">⚠️</span>
                <span className="flag-text">Structural Concerns Present</span>
              </div>
            )}
            
            {damage.progressiveIssues && (
              <div className="flag-item progressive-issues">
                <span className="flag-icon">📈</span>
                <span className="flag-text">Progressive Damage (Will Worsen)</span>
              </div>
            )}
          </div>
          
          {damage.recommendedAction && (
            <div className="recommended-action">
              <h4>Recommended Action:</h4>
              <p>{damage.recommendedAction}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRepairAssessment = () => {
    const repair = analysisData.repairAssessment || {};
    
    return (
      <div className="repair-assessment-container">
        <div className="repair-summary">
          <div className={`recommendation-indicator recommendation-${(repair.repairRecommendation || "").toLowerCase().replace(/\s+/g, '-')}`}>
            <span className="recommendation-label">Recommendation:</span>
            <span className="recommendation-value">{repair.repairRecommendation || "Unknown"}</span>
          </div>
          
          <div className={`urgency-indicator urgency-${(repair.urgency || "").toLowerCase()}`}>
            <span className="urgency-label">Urgency:</span>
            <span className="urgency-value">{repair.urgency || "Unknown"}</span>
          </div>
        </div>
        
        <div className="repair-details">
          <div className="repair-difficulty">
            <span className="difficulty-label">Repair Difficulty:</span>
            <span className="difficulty-value">{repair.repairDifficulty || "Unknown"}</span>
          </div>
          
          <div className="diy-feasibility">
            <span className="diy-label">DIY Feasible:</span>
            <span className="diy-value">{repair.diyFeasibility ? "Yes" : "No"}</span>
          </div>
          
          <div className="cost-estimates">
            <div className="cost-item repair-cost">
              <span className="cost-label">Estimated Repair Cost:</span>
              <span className="cost-value">{repair.anticipatedRepairCost || "Unknown"}</span>
            </div>
            
            <div className="cost-item replacement-cost">
              <span className="cost-label">Estimated Replacement Cost:</span>
              <span className="cost-value">{repair.anticipatedReplacementCost || "Unknown"}</span>
            </div>
          </div>
          
          {repair.specialConsiderations && repair.specialConsiderations.length > 0 && (
            <div className="special-considerations">
              <h4>Special Considerations:</h4>
              <ul className="considerations-list">
                {repair.specialConsiderations.map((consideration, index) => (
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
    const metadata = analysisData.metadata || {};
    
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
            <span className="visibility-value">{metadata.visibleSectionEstimate || 0}%</span>
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
          <pre>{JSON.stringify(analysisData, null, 2)}</pre>
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
