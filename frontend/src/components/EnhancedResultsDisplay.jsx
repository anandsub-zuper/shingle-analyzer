// src/components/EnhancedResultsDisplay.jsx
import React, { useState, useEffect } from 'react';
import '../styles/EnhancedResultsDisplay.css';

// Import both utility files
import { 
  extractJsonFromContent, 
  normalizeApiResponse, 
  safeGet,
  attemptJsonRepair,
  extractJsonAggressively  
} from '../utils/jsonUtils';

/*import {
  calculateTotalDamagePercentage,
  calculateRemainingLife,
  getRepairPriority,
  estimateRepairCosts,
  getRepairOrReplaceRecommendation
} from '../utils/responseUtils';*/

const EnhancedResultsDisplay = ({ results }) => {
  const [activeTab, setActiveTab] = useState('specifications');
  const [parsedData, setParsedData] = useState(null);
  // Additional state for calculated metrics
  const [calculatedMetrics, setCalculatedMetrics] = useState({
    damagePercentage: 0,
    remainingLife: { years: 'Unknown', percentage: 0 },
    repairPriority: 'Unknown',
    costEstimates: { repair: 'Unknown', replacement: 'Unknown' },
    repairRecommendation: { recommendation: 'Unknown', reasoning: 'Unknown' }
  });
  
  // Parse data when results change
  /*useEffect(() => {
    if (results) {
      // First extract and normalize the JSON structure
      let extractedData = null;
      
      // Check if we already have parsed results from backend
      if (results.parsedResults) {
        console.log("Using pre-parsed results from backend");
        extractedData = normalizeApiResponse(results.parsedResults);
      } else if (results.choices && results.choices[0] && results.choices[0].message) {
        // Try to extract from message content
        const content = results.choices[0].message.content;
        
        // Try to parse directly if it's already an object
        if (typeof content === 'object' && content !== null) {
          console.log("Content is already an object");
          extractedData = normalizeApiResponse(content);
        } else if (typeof content === 'string') {
          // Try to extract JSON from the content string
          const extractedJson = extractJsonFromContent(content);
          if (extractedJson) {
            extractedData = normalizeApiResponse(extractedJson);
          } else {
            // Try repair as a last resort
            const repairedJson = attemptJsonRepair(content);
            const extractedRepairedJson = extractJsonFromContent(repairedJson);
            if (extractedRepairedJson) {
              extractedData = normalizeApiResponse(extractedRepairedJson);
            }
          }
        }
      }
      
      if (!extractedData) {
        // Last resort fallback
        extractedData = {
          materialSpecification: { name: "Unknown" },
          damageAssessment: { overallCondition: "Unknown" },
          repairAssessment: {},
          metadata: {}
        };
      }
      
      console.log("Extracted data:", extractedData);
      setParsedData(extractedData);
      
      // Calculate additional metrics using responseUtils once we have data
      if (extractedData) {
        calculateMetrics(extractedData);
      }
    }
  }, [results]); */

  useEffect(() => {
  if (results) {
    console.log("Processing API results...");
    
    // First extract and normalize the JSON structure
    let extractedData = null;
    
    try {
      // APPROACH 1: Check if we already have parsed results from backend
      if (results.parsedResults) {
        console.log("Using pre-parsed results from backend");
        extractedData = normalizeApiResponse(results.parsedResults);
      } 
      // APPROACH 2: Extract from message content
      else if (results.choices && results.choices[0] && results.choices[0].message) {
        const content = results.choices[0].message.content;
        console.log("Content type:", typeof content);
        
        // 2A: Try to parse directly if it's already an object
        if (typeof content === 'object' && content !== null) {
          console.log("Content is already an object");
          extractedData = normalizeApiResponse(content);
        } 
        // 2B: Extract JSON from string content
        else if (typeof content === 'string') {
          console.log("Attempting to extract JSON from string content");
          
          // Try standard extraction first
          const extractedJson = extractJsonFromContent(content);
          if (extractedJson) {
            console.log("Standard JSON extraction successful");
            extractedData = normalizeApiResponse(extractedJson);
          } 
          // Try repair if standard extraction failed
          else {
            console.log("Standard extraction failed, attempting repair...");
            const repairedContent = attemptJsonRepair(content);
            const extractedRepairedJson = extractJsonFromContent(repairedContent);
            
            if (extractedRepairedJson) {
              console.log("Extraction after repair successful");
              extractedData = normalizeApiResponse(extractedRepairedJson);
            } 
            // Last resort: Try to extract largest JSON object
            else {
              console.log("Repair extraction failed, trying aggressive extraction...");
              const aggressiveJson = extractJsonAggressively(content);
              
              if (aggressiveJson) {
                console.log("Aggressive extraction successful");
                extractedData = normalizeApiResponse(aggressiveJson);
              }
            }
          }
        }
      }
      // APPROACH 3: If all else fails, try to normalize the entire results object
      if (!extractedData) {
        console.log("All extraction methods failed, trying to normalize entire results object");
        extractedData = normalizeApiResponse(results);
      }
      
      // DATA VALIDATION: Ensure we have meaningful data
      const hasData = extractedData && 
                     (Object.keys(extractedData.materialSpecification || {}).length > 0 || 
                      Object.keys(extractedData.damageAssessment || {}).length > 0);
      
      if (!hasData) {
        console.warn("Extraction resulted in empty data, creating fallback structure");
        extractedData = {
          materialSpecification: { name: "Data extraction issue - please try again" },
          damageAssessment: {},
          repairAssessment: {},
          metadata: { 
            confidenceScore: 0,
            visibilityQuality: "Unknown",
            limitationNotes: "Could not properly extract data from the API response.",
            additionalInspectionNeeded: true
          }
        };
      }
      
      // Set parsed data state
      console.log("Final extracted data:", extractedData);
      setParsedData(extractedData);
      
      // CALCULATED METRICS HANDLING: Set calculated metrics from API response
      if (extractedData && 
          (extractedData.CALCULATED_METRICS || 
           extractedData.calculatedMetrics)) {
        
        // Get metrics from proper property (handle case variations)
        const metrics = extractedData.CALCULATED_METRICS || 
                       extractedData.calculatedMetrics || 
                       {};
        
        console.log("Found AI-calculated metrics:", metrics);
        
        // Validate and normalize damage percentage
        let damagePercentage = safeGet(metrics, 'totalDamagePercentage', 0);
        if (typeof damagePercentage === 'string') {
          // Extract number from string like "45%" or "about 45%"
          const match = damagePercentage.match(/(\d+)/);
          damagePercentage = match ? parseInt(match[1], 10) : 0;
        }
        damagePercentage = !isNaN(damagePercentage) ? 
          Math.min(100, Math.max(0, Number(damagePercentage))) : 0;
        
        // Validate remaining life structure
        let remainingLife = safeGet(metrics, 'remainingLife', { years: 'Unknown', percentage: 0 });
        if (typeof remainingLife !== 'object' || remainingLife === null) {
          remainingLife = { years: 'Unknown', percentage: 0 };
        } else {
          // Ensure years property exists
          if (!remainingLife.years) {
            remainingLife.years = 'Unknown';
          }
          
          // Normalize percentage to be a valid number between 0-100
          let percentage = remainingLife.percentage;
          if (typeof percentage === 'string') {
            const match = percentage.match(/(\d+)/);
            percentage = match ? parseInt(match[1], 10) : 0;
          }
          remainingLife.percentage = !isNaN(percentage) ? 
            Math.min(100, Math.max(0, Number(percentage))) : 0;
        }
        
        // Validate repair priority
        let repairPriority = safeGet(metrics, 'repairPriority', 'Unknown');
        
        // Validate cost estimates
        let costEstimates = safeGet(metrics, 'costEstimates', { repair: 'Unknown', replacement: 'Unknown' });
        if (typeof costEstimates !== 'object' || costEstimates === null) {
          costEstimates = { repair: 'Unknown', replacement: 'Unknown' };
        }
        
        // Validate repair recommendation
        let repairRecommendation = safeGet(metrics, 'repairRecommendation', { 
          recommendation: 'Unknown', 
          reasoning: 'Unknown' 
        });
        
        if (typeof repairRecommendation !== 'object' || repairRecommendation === null) {
          repairRecommendation = { recommendation: 'Unknown', reasoning: 'Unknown' };
        } else {
          // Ensure required properties exist
          if (!repairRecommendation.recommendation) {
            repairRecommendation.recommendation = 'Unknown';
          }
          if (!repairRecommendation.reasoning) {
            repairRecommendation.reasoning = 'Unknown';
          }
        }
        
        // Set the validated and normalized metrics
        setCalculatedMetrics({
          damagePercentage,
          remainingLife,
          repairPriority,
          costEstimates,
          repairRecommendation
        });
        
        console.log("Using AI-calculated metrics with validation");
      } 
      // FALLBACK: Use default values if no calculated metrics found
      else {
        console.warn("No AI-calculated metrics found, using defaults");
        setCalculatedMetrics({
          damagePercentage: 0,
          remainingLife: { years: 'Unknown', percentage: 0 },
          repairPriority: 'Unknown',
          costEstimates: { repair: 'Unknown', replacement: 'Unknown' },
          repairRecommendation: { recommendation: 'Unknown', reasoning: 'Unknown' }
        });
      }
    } 
    // ERROR HANDLING: Comprehensive error handling for the entire process
    catch (error) {
      console.error("Error processing API response:", error);
      
      // Set fallback values for both data structures
      setParsedData({
        materialSpecification: { 
          name: "Error processing response data",
          material: "Unknown",
          materialSubtype: "Error occurred during extraction"
        },
        damageAssessment: {
          overallCondition: "Unknown",
          description: "An error occurred while processing the analysis results."
        },
        repairAssessment: {},
        metadata: {
          confidenceScore: 0,
          visibilityQuality: "Unknown",
          limitationNotes: `Error: ${error.message}. Please try again.`,
          additionalInspectionNeeded: true
        }
      });
      
      setCalculatedMetrics({
        damagePercentage: 0,
        remainingLife: { years: 'Unknown', percentage: 0 },
        repairPriority: 'Unknown',
        costEstimates: { repair: 'Unknown', replacement: 'Unknown' },
        repairRecommendation: { 
          recommendation: 'Unknown', 
          reasoning: 'An error occurred while processing the results.' 
        }
      });
    }
  }
}, [results]);

// In EnhancedResultsDisplay.jsx - Update the useEffect for parsing


  
  // Calculate metrics using responseUtils
  const calculateMetrics = (data) => {
    const { materialSpecification, damageAssessment } = data;
    
    // Only proceed with calculations if we have meaningful data
    if (!damageAssessment || !materialSpecification) return;
    
    try {
      // Calculate total damage percentage
      const damagePercentage = calculateTotalDamagePercentage(damageAssessment);
      
      // Calculate remaining life
      const remainingLife = calculateRemainingLife(materialSpecification, damageAssessment);
      
      // Get repair priority
      const repairPriority = getRepairPriority(damageAssessment);
      
      // Estimate repair costs
      const costEstimates = estimateRepairCosts(damageAssessment, materialSpecification);
      
      // Get repair or replace recommendation
      const repairRecommendation = getRepairOrReplaceRecommendation(damageAssessment, materialSpecification);
      
      // Update state with calculated metrics
      setCalculatedMetrics({
        damagePercentage,
        remainingLife,
        repairPriority,
        costEstimates,
        repairRecommendation
      });
      
      console.log("Calculated metrics:", {
        damagePercentage,
        remainingLife,
        repairPriority,
        costEstimates,
        repairRecommendation
      });
    } catch (error) {
      console.error("Error calculating metrics:", error);
    }
  };
  
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
          
          {/* Display calculated remaining life */}
          <div className="spec-item">
            <span className="spec-label">Remaining Life</span>
            <span className="spec-value">
              {calculatedMetrics.remainingLife.years}
              {calculatedMetrics.remainingLife.percentage > 0 && (
                <span className="percentage-indicator"> ({calculatedMetrics.remainingLife.percentage}%)</span>
              )}
            </span>
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
          
          {/* Display calculated total damage percentage */}
          <div className="total-damage-percentage">
            <span className="percentage-label">Total Affected Area:</span>
            <div className="percentage-meter">
              <div 
                className="percentage-fill" 
                style={{ 
                  width: `${calculatedMetrics.damagePercentage}%`,
                  backgroundColor: getSeverityColor(Math.min(10, calculatedMetrics.damagePercentage / 10))
                }}
              />
              <span className="percentage-value">{calculatedMetrics.damagePercentage}%</span>
            </div>
          </div>
          
          {/* Display calculated repair priority */}
          <div className="repair-priority">
            <span className="priority-label">Priority:</span>
            <span className="priority-value">{calculatedMetrics.repairPriority}</span>
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
        
        {/* Display calculated repair vs replace recommendation */}
        {calculatedMetrics.repairRecommendation.recommendation !== 'Unknown' && (
          <div className="calculated-recommendation">
            <h3 className="section-subtitle">Repair vs. Replace Analysis</h3>
            <div className={`recommendation-box recommendation-${calculatedMetrics.repairRecommendation.recommendation.toLowerCase()}`}>
              <div className="recommendation-header">
                <span className="recommendation-icon">
                  {calculatedMetrics.repairRecommendation.recommendation === 'Replace' ? '🔄' : '🔧'}
                </span>
                <h4>{calculatedMetrics.repairRecommendation.recommendation}</h4>
              </div>
              <p className="recommendation-reasoning">
                {calculatedMetrics.repairRecommendation.reasoning}
              </p>
            </div>
          </div>
        )}
        
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
              <span className="cost-label">API Estimated Repair Cost:</span>
              <span className="cost-value">{safeGet(repairAssessment, 'anticipatedRepairCost')}</span>
            </div>
            
            <div className="cost-item replacement-cost">
              <span className="cost-label">API Estimated Replacement Cost:</span>
              <span className="cost-value">{safeGet(repairAssessment, 'anticipatedReplacementCost')}</span>
            </div>
            
            {/* Display calculated cost estimates */}
            {calculatedMetrics.costEstimates.repair !== 'Unknown' && (
              <>
                <div className="cost-item calculated-repair-cost">
                  <span className="cost-label">Calculated Repair Cost:</span>
                  <span className="cost-value">{calculatedMetrics.costEstimates.repair}</span>
                </div>
                
                <div className="cost-item calculated-replacement-cost">
                  <span className="cost-label">Calculated Replacement Cost:</span>
                  <span className="cost-value">{calculatedMetrics.costEstimates.replacement}</span>
                </div>
              </>
            )}
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
        
        {/* Display all calculated metrics in a summarized view */}
        <div className="calculated-metrics-section">
          <h4>Calculated Metrics Summary</h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Total Damage %:</span>
              <span className="metric-value">{calculatedMetrics.damagePercentage}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Remaining Life:</span>
              <span className="metric-value">{calculatedMetrics.remainingLife.years} ({calculatedMetrics.remainingLife.percentage}%)</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Repair Priority:</span>
              <span className="metric-value">{calculatedMetrics.repairPriority}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Recommendation:</span>
              <span className="metric-value">{calculatedMetrics.repairRecommendation.recommendation}</span>
            </div>
          </div>
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
        
        <h3>Calculated Metrics</h3>
        <div className="raw-data-code">
          <pre>{JSON.stringify(calculatedMetrics, null, 2)}</pre>
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
    console.log("Calculated metrics:", calculatedMetrics);
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
