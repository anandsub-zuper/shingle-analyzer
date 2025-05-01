// src/components/AdvancedResultsDisplay.jsx
import React, { useState, useEffect } from 'react';
import '../styles/AdvancedResultsDisplay.css';
import { extractJsonFromContent, safeGet } from '../utils/jsonUtils';

const AdvancedResultsDisplay = ({ results }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [parsedData, setParsedData] = useState(null);
  
  // Parse data when results change
  useEffect(() => {
    if (results) {
      // First try to use parsed results from backend
      if (results.parsedResults) {
        setParsedData(results.parsedResults);
      } else if (results.choices && results.choices[0]?.message?.content) {
        // Try to extract JSON from content
        const content = results.choices[0].message.content;
        const extractedData = extractJsonFromContent(content);
        if (extractedData) {
          setParsedData(extractedData);
        }
      }
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
        <p>The analysis is still being processed or couldn't be parsed correctly.</p>
      </div>
    );
  }

  // Helper functions
  const getSeverityColor = (severity) => {
    if (severity <= 3) return 'var(--success)';
    if (severity <= 6) return 'var(--warning)';
    if (severity <= 8) return '#FF9800'; // Orange
    return 'var(--danger)';
  };

  // Overview tab
  const renderOverview = () => {
    return (
      <div className="advanced-overview-container">
        <div className="overview-header">
          <div className="material-heading">
            <h3>{safeGet(parsedData, 'materialSpecification.name', 'Roof Analysis')}</h3>
            <div className="material-subheading">
              {safeGet(parsedData, 'materialSpecification.manufacturer') !== 'Unknown' && (
                <span className="material-manufacturer">
                  {safeGet(parsedData, 'materialSpecification.manufacturer')}
                </span>
              )}
              {safeGet(parsedData, 'materialSpecification.materialSubtype') !== 'Unknown' && (
                <span className="material-type">
                  {safeGet(parsedData, 'materialSpecification.materialSubtype')}
                </span>
              )}
            </div>
          </div>
          
          <div className="condition-badge condition-badge-large">
            <span className="condition-text">
              {safeGet(parsedData, 'damageAssessment.overallCondition', 'Unknown')}
            </span>
          </div>
        </div>
        
        <div className="overview-cards">
          {/* Measurements Card */}
          <div className="overview-card measurements-card">
            <h4 className="card-title">
              <span className="card-icon">📏</span>
              Measurements
            </h4>
            <div className="card-content">
              <div className="measurement-item">
                <span className="measurement-label">Total Area</span>
                <span className="measurement-value">
                  {safeGet(parsedData, 'advancedMeasurements.totalRoofArea.value')} sq ft
                </span>
              </div>
              <div className="measurement-item">
                <span className="measurement-label">Pitch</span>
                <span className="measurement-value">
                  {safeGet(parsedData, 'advancedMeasurements.roofPitch.primary')} 
                  ({safeGet(parsedData, 'advancedMeasurements.roofPitch.degrees')}°)
                </span>
              </div>
              <div className="measurement-item">
                <span className="measurement-label">Dimensions</span>
                <span className="measurement-value">
                  {safeGet(parsedData, 'advancedMeasurements.roofDimensions.length')}' × 
                  {safeGet(parsedData, 'advancedMeasurements.roofDimensions.width')}'
                </span>
              </div>
              <div className="measurement-accuracy">
                Confidence: {safeGet(parsedData, 'advancedMeasurements.totalRoofArea.confidenceScore', 0)}/10
              </div>
            </div>
          </div>
          
          {/* Material Estimation Card */}
          <div className="overview-card materials-card">
            <h4 className="card-title">
              <span className="card-icon">🏠</span>
              Material Estimate
            </h4>
            <div className="card-content">
              <div className="material-item">
                <span className="material-label">Squares Needed</span>
                <span className="material-value">
                  {safeGet(parsedData, 'materialQuantityEstimation.shingleSquares.value', 0)} 
                  <span className="material-unit">squares</span>
                </span>
              </div>
              <div className="material-item">
                <span className="material-label">With Waste Factor</span>
                <span className="material-value">
                  {safeGet(parsedData, 'materialQuantityEstimation.shingleSquares.adjustedValue', 0)} 
                  <span className="material-unit">squares</span>
                </span>
              </div>
              <div className="material-item">
                <span className="material-label">Ridge Cap</span>
                <span className="material-value">
                  {safeGet(parsedData, 'materialQuantityEstimation.accessoryQuantities.ridgeCap', 0)} 
                  <span className="material-unit">lin. ft</span>
                </span>
              </div>
              <div className="material-accuracy">
                Waste %: {safeGet(parsedData, 'materialQuantityEstimation.wastePercentage.value', '10-15')}%
              </div>
            </div>
          </div>
          
          {/* Damage Summary Card */}
          <div className="overview-card damage-card">
            <h4 className="card-title">
              <span className="card-icon">⚠️</span>
              Damage Summary
            </h4>
            <div className="card-content">
              <div className="damage-severity">
                <span className="damage-label">Severity</span>
                <div className="severity-bar-container">
                  <div 
                    className="severity-bar" 
                    style={{ 
                      width: `${Math.min(100, (safeGet(parsedData, 'damageAssessment.damageSeverity', 0) * 10))}%`,
                      backgroundColor: getSeverityColor(safeGet(parsedData, 'damageAssessment.damageSeverity', 0))
                    }}
                  ></div>
                </div>
                <span className="severity-value">{safeGet(parsedData, 'damageAssessment.damageSeverity', 0)}/10</span>
              </div>
              
              <div className="damage-types">
                <span className="damage-label">Types</span>
                <div className="damage-tags">
                  {Array.isArray(safeGet(parsedData, 'damageAssessment.damageTypes', [])) && 
                   safeGet(parsedData, 'damageAssessment.damageTypes', []).slice(0, 3).map((type, index) => (
                    <span key={index} className="damage-tag">{type}</span>
                  ))}
                  {Array.isArray(safeGet(parsedData, 'damageAssessment.damageTypes', [])) && 
                   safeGet(parsedData, 'damageAssessment.damageTypes', []).length > 3 && (
                    <span className="damage-tag more-tag">+{safeGet(parsedData, 'damageAssessment.damageTypes', []).length - 3} more</span>
                  )}
                </div>
              </div>
              
              <div className="recommendation">
                <span className="recommendation-label">Recommendation</span>
                <span className="recommendation-value">
                  {safeGet(parsedData, 'repairAssessment.repairRecommendation', 'Unknown')}
                </span>
              </div>
            </div>
          </div>
          
          {/* 3D Structure Card */}
          <div className="overview-card structure-card">
            <h4 className="card-title">
              <span className="card-icon">🏛️</span>
              Roof Structure
            </h4>
            <div className="card-content">
              <div className="structure-item">
                <span className="structure-label">Type</span>
                <span className="structure-value">{safeGet(parsedData, 'threeDimensionalStructure.roofType', 'Unknown')}</span>
              </div>
              <div className="structure-item">
                <span className="structure-label">Complexity</span>
                <span className="structure-value">{safeGet(parsedData, 'threeDimensionalStructure.roofComplexity', 0)}/10</span>
              </div>
              <div className="structure-item">
                <span className="structure-label">Facets</span>
                <span className="structure-value">{safeGet(parsedData, 'threeDimensionalStructure.numberOfFacets', 0)}</span>
              </div>
              <div className="structure-features">
                {safeGet(parsedData, 'threeDimensionalStructure.skylights.count', 0) > 0 && (
                  <span className="feature-pill">{safeGet(parsedData, 'threeDimensionalStructure.skylights.count', 0)} Skylights</span>
                )}
                {safeGet(parsedData, 'threeDimensionalStructure.vents.count', 0) > 0 && (
                  <span className="feature-pill">{safeGet(parsedData, 'threeDimensionalStructure.vents.count', 0)} Vents</span>
                )}
                {safeGet(parsedData, 'threeDimensionalStructure.chimneys.count', 0) > 0 && (
                  <span className="feature-pill">{safeGet(parsedData, 'threeDimensionalStructure.chimneys.count', 0)} Chimneys</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Summary */}
        <div className="action-summary">
          <div className="action-header">
            <h4>Recommended Actions</h4>
            <div className="urgency-badge">
              Urgency: {safeGet(parsedData, 'repairAssessment.urgency', 'Unknown')}
            </div>
          </div>
          
          <div className="action-content">
            <p className="action-description">
              {safeGet(parsedData, 'damageAssessment.recommendedAction', 'No specific recommendations provided.')}
            </p>
            
            {parsedData.emergencyAssessment?.emergencyIssuesDetected && (
              <div className="emergency-notice">
                <span className="emergency-icon">🚨</span>
                <div className="emergency-text">
                  <strong>Critical Issue Detected:</strong> {safeGet(parsedData, 'emergencyAssessment.immediateConcerns[0]', 'Immediate attention required.')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Measurements tab
  const renderMeasurements = () => {
    const measurements = parsedData.advancedMeasurements || {};
    const structure = parsedData.threeDimensionalStructure || {};
    
    return (
      <div className="measurements-container">
        <div className="measurements-grid">
          <div className="measurements-section area-section">
            <h3 className="section-title">Area Measurements</h3>
            <div className="measurement-card">
              <div className="measurement-header">
                <h4>Total Roof Area</h4>
                <div className="confidence-badge">
                  Confidence: {safeGet(measurements, 'totalRoofArea.confidenceScore', 0)}/10
                </div>
              </div>
              <div className="measurement-value primary-value">
                {safeGet(measurements, 'totalRoofArea.value', 'Unknown')} 
                <span className="measurement-unit">sq ft</span>
              </div>
              <div className="measurement-details">
                <div className="detail-item">
                  <span className="detail-label">Precision Factor:</span>
                  <span className="detail-value">±{safeGet(measurements, 'totalRoofArea.precisionFactor', '10')}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Visible Percentage:</span>
                  <span className="detail-value">{safeGet(measurements, 'totalRoofArea.visiblePercentage', 'Unknown')}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Measurement Method:</span>
                  <span className="detail-value">{safeGet(measurements, 'totalRoofArea.method', 'Visual estimation')}</span>
                </div>
              </div>
            </div>
            
            {/* Facet Measurements Table */}
            {Array.isArray(measurements.facetMeasurements) && measurements.facetMeasurements.length > 0 && (
              <div className="facets-table-container">
                <h4>Roof Facet Measurements</h4>
                <div className="facets-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Facet</th>
                        <th>Area (sq ft)</th>
                        <th>Dimensions</th>
                        <th>Pitch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.facetMeasurements.map((facet, index) => (
                        <tr key={index}>
                          <td>{facet.facetId || `Facet ${index+1}`}</td>
                          <td>{facet.area || 'Unknown'}</td>
                          <td>
                            {facet.dimensions?.length ? `${facet.dimensions.length}' × ${facet.dimensions.width}'` : 'Unknown'}
                          </td>
                          <td>
                            {facet.pitch?.ratio || 'Unknown'} 
                            {facet.pitch?.degrees ? ` (${facet.pitch.degrees}°)` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          <div className="measurements-section dimensions-section">
            <h3 className="section-title">Dimensions & Pitch</h3>
            <div className="dimensions-cards">
              <div className="measurement-card">
                <div className="measurement-header">
                  <h4>Roof Dimensions</h4>
                  <div className="confidence-badge">
                    Confidence: {safeGet(measurements, 'roofDimensions.confidenceScore', 0)}/10
                  </div>
                </div>
                <div className="dimension-values">
                  <div className="dimension-item">
                    <span className="dimension-label">Length</span>
                    <span className="dimension-value">
                      {safeGet(measurements, 'roofDimensions.length', 'Unknown')}
                      <span className="dimension-unit">ft</span>
                    </span>
                  </div>
                  <div className="dimension-item">
                    <span className="dimension-label">Width</span>
                    <span className="dimension-value">
                      {safeGet(measurements, 'roofDimensions.width', 'Unknown')}
                      <span className="dimension-unit">ft</span>
                    </span>
                  </div>
                  <div className="dimension-item">
                    <span className="dimension-label">Height</span>
                    <span className="dimension-value">
                      {safeGet(measurements, 'roofDimensions.height', 'Unknown')}
                      <span className="dimension-unit">ft</span>
                    </span>
                  </div>
                </div>
                <div className="reference-methods">
                  <span className="reference-label">Reference Methods:</span>
                  <div className="reference-tags">
                    {Array.isArray(measurements.roofDimensions?.referenceMethods) ? 
                      measurements.roofDimensions.referenceMethods.map((method, index) => (
                        <span key={index} className="reference-tag">{method}</span>
                      )) : 
                      <span className="reference-tag">Visual estimation</span>
                    }
                  </div>
                </div>
              </div>
              
              <div className="measurement-card">
                <div className="measurement-header">
                  <h4>Roof Pitch</h4>
                  <div className="confidence-badge">
                    Confidence: {safeGet(measurements, 'roofPitch.confidenceScore', 0)}/10
                  </div>
                </div>
                <div className="pitch-values">
                  <div className="pitch-item primary">
                    <span className="pitch-label">Ratio</span>
                    <span className="pitch-value">
                      {safeGet(measurements, 'roofPitch.primary', 'Unknown')}
                    </span>
                  </div>
                  <div className="pitch-item">
                    <span className="pitch-label">Degrees</span>
                    <span className="pitch-value">
                      {safeGet(measurements, 'roofPitch.degrees', 'Unknown')}°
                    </span>
                  </div>
                </div>
                <div className="pitch-method">
                  <span className="method-label">Measurement Method:</span>
                  <span className="method-value">{safeGet(measurements, 'roofPitch.method', 'Visual estimation')}</span>
                </div>
                
                {/* Secondary Pitches */}
                {Array.isArray(structure.secondaryPitches) && structure.secondaryPitches.length > 0 && (
                  <div className="secondary-pitches">
                    <span className="secondary-label">Secondary Pitches:</span>
                    <div className="secondary-values">
                      {structure.secondaryPitches.map((pitch, index) => (
                        <span key={index} className="secondary-pitch">{pitch}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="measurement-card">
                <div className="measurement-header">
                  <h4>Linear Measurements</h4>
                </div>
                <div className="linear-measurements">
                  <div className="linear-item">
                    <span className="linear-label">Ridge Length</span>
                    <span className="linear-value">
                      {safeGet(measurements, 'ridgeLength.value', 'Unknown')}
                      <span className="linear-unit">ft</span>
                    </span>
                  </div>
                  <div className="linear-item">
                    <span className="linear-label">Valley Length</span>
                    <span className="linear-value">
                      {safeGet(measurements, 'valleyLength.value', 'Unknown')}
                      <span className="linear-unit">ft</span>
                    </span>
                  </div>
                  <div className="linear-item">
                    <span className="linear-label">Eave Length</span>
                    <span className="linear-value">
                      {safeGet(measurements, 'eaveLength.value', 'Unknown')}
                      <span className="linear-unit">ft</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Visual Reference Analysis */}
        <div className="visual-reference-section">
          <h3 className="section-title">Measurement Methods</h3>
          
          <div className="reference-features">
            <h4>Reference Features Used</h4>
            <div className="reference-list">
              {Array.isArray(parsedData.visualReferenceAnalysis?.referenceFeaturesIdentified) ? 
                parsedData.visualReferenceAnalysis.referenceFeaturesIdentified.map((feature, index) => (
                  <div key={index} className="reference-item">
                    <div className="reference-header">
                      <span className="reference-type">{feature.type}</span>
                      <span className="reference-dim">{feature.dimensions}</span>
                    </div>
                    <div className="reference-details">
                      <span className="reference-used">Used for: {feature.usedFor}</span>
                    </div>
                  </div>
                )) : 
                <div className="no-references">No specific reference features identified</div>
              }
            </div>
          </div>
          
          <div className="measurement-methods">
            <h4>Measurement Approach</h4>
            <div className="method-details">
              <div className="method-item">
                <span className="method-label">Scale Established Via:</span>
                <span className="method-value">{safeGet(parsedData, 'visualReferenceAnalysis.scaleEstablishment.method', 'Unknown')}</span>
              </div>
              {parsedData.multiImageIntegration?.imageAlignment && (
                <div className="method-item">
                  <span className="method-label">Images Aligned Via:</span>
                  <span className="method-value">{safeGet(parsedData, 'multiImageIntegration.imageAlignment.matchedPoints', 0)} matched points</span>
                </div>
              )}
              {parsedData.multiImageIntegration?.measurementConsistency && (
                <div className="method-item">
                  <span className="method-label">Measurement Consistency:</span>
                  <span className="method-value">{safeGet(parsedData, 'multiImageIntegration.measurementConsistency.overallConsistency', 0)}/10</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Structure tab
  const renderStructure = () => {
    const structure = parsedData.threeDimensionalStructure || {};
    
    return (
      <div className="structure-container">
        <div className="structure-overview">
          <div className="structure-card main-structure">
            <h3 className="structure-title">Roof Structure</h3>
            <div className="structure-primary-details">
              <div className="structure-detail">
                <span className="detail-label">Type</span>
                <span className="detail-value">{safeGet(structure, 'roofType', 'Unknown')}</span>
              </div>
              <div className="structure-detail">
                <span className="detail-label">Complexity</span>
                <span className="detail-value">{safeGet(structure, 'roofComplexity', 0)}/10</span>
              </div>
              <div className="structure-detail">
                <span className="detail-label">Facets</span>
                <span className="detail-value">{safeGet(structure, 'numberOfFacets', 0)}</span>
              </div>
              <div className="structure-detail">
                <span className="detail-label">Primary Pitch</span>
                <span className="detail-value">{safeGet(structure, 'primaryPitch', 'Unknown')}</span>
              </div>
            </div>
          </div>
          
          <div className="structure-features-grid">
            {/* Dormers */}
            <div className="structure-card feature-card">
              <div className="feature-header">
                <h4>Dormers</h4>
                <span className="feature-count">{safeGet(structure, 'dormers.count', 0)}</span>
              </div>
              {structure.dormers?.count > 0 ? (
                <div className="feature-details">
                  <div className="feature-types">
                    <span className="types-label">Types:</span>
                    <div className="types-list">
                      {Array.isArray(structure.dormers.types) && structure.dormers.types.map((type, index) => (
                        <span key={index} className="type-tag">{type}</span>
                      ))}
                    </div>
                  </div>
                  {Array.isArray(structure.dormers.dimensions) && structure.dormers.dimensions.length > 0 && (
                    <div className="feature-dimensions">
                      <span className="dimensions-label">Dimensions:</span>
                      <div className="dimensions-list">
                        {structure.dormers.dimensions.map((dim, index) => (
                          <span key={index} className="dimension-tag">{dim}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-features">No dormers detected</div>
              )}
            </div>
            
            {/* Chimneys */}
            <div className="structure-card feature-card">
              <div className="feature-header">
                <h4>Chimneys</h4>
                <span className="feature-count">{safeGet(structure, 'chimneys.count', 0)}</span>
              </div>
              {structure.chimneys?.count > 0 ? (
                <div className="feature-details">
                  {Array.isArray(structure.chimneys.locations) && structure.chimneys.locations.length > 0 && (
                    <div className="feature-locations">
                      <span className="locations-label">Locations:</span>
                      <div className="locations-list">
                        {structure.chimneys.locations.map((location, index) => (
                          <span key={index} className="location-tag">{location}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-features">No chimneys detected</div>
              )}
            </div>
            
            {/* Skylights */}
            <div className="structure-card feature-card">
              <div className="feature-header">
                <h4>Skylights</h4>
                <span className="feature-count">{safeGet(structure, 'skylights.count', 0)}</span>
              </div>
              {structure.skylights?.count > 0 ? (
                <div className="feature-details">
                  {Array.isArray(structure.skylights.dimensions) && structure.skylights.dimensions.length > 0 && (
                    <div className="feature-dimensions">
                      <span className="dimensions-label">Dimensions:</span>
                      <div className="dimensions-list">
                        {structure.skylights.dimensions.map((dim, index) => (
                          <span key={index} className="dimension-tag">{dim}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-features">No skylights detected</div>
              )}
            </div>
            
            {/* Vents */}
            <div className="structure-card feature-card">
              <div className="feature-header">
                <h4>Vents</h4>
                <span className="feature-count">{safeGet(structure, 'vents.count', 0)}</span>
              </div>
              {structure.vents?.count > 0 ? (
                <div className="feature-details">
                  {Array.isArray(structure.vents.types) && structure.vents.types.length > 0 && (
                    <div className="feature-types">
                      <span className="types-label">Types:</span>
                      <div className="types-list">
                        {structure.vents.types.map((type, index) => (
                          <span key={index} className="type-tag">{type}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-features">No vents detected</div>
              )}
            </div>
          </div>
          
          <div className="structure-card edge-features">
            <h3 className="structure-title">Roof Edges & Features</h3>
            <div className="edge-features-grid">
              <div className="edge-feature">
                <div className="edge-header">
                  <h4>Valleys</h4>
                </div>
                <div className="edge-details">
                  <div className="edge-count">Count: {safeGet(structure, 'valleys.count', 0)}</div>
                  {structure.valleys?.totalLength && (
                    <div className="edge-length">Length: {structure.valleys.totalLength} ft</div>
                  )}
                </div>
              </div>
              
              <div className="edge-feature">
                <div className="edge-header">
                  <h4>Ridges</h4>
                </div>
                <div className="edge-details">
                  <div className="edge-count">Count: {safeGet(structure, 'ridges.count', 0)}</div>
                  {structure.ridges?.totalLength && (
                    <div className="edge-length">Length: {structure.ridges.totalLength} ft</div>
                  )}
                </div>
              </div>
              
              <div className="edge-feature">
                <div className="edge-header">
                  <h4>Overhangs</h4>
                </div>
                <div className="edge-details">
                  {structure.overhangs?.typical && (
                    <div className="overhang-depth">Depth: {structure.overhangs.typical}"</div>
                  )}
                  {Array.isArray(structure.overhangs?.directions) && structure.overhangs.directions.length > 0 && (
                    <div className="overhang-directions">
                      <span>Directions:</span>
                      <div className="direction-tags">
                        {structure.overhangs.directions.map((dir, index) => (
                          <span key={index} className="direction-tag">{dir}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Special Features */}
            {Array.isArray(structure.specialFeatures) && structure.specialFeatures.length > 0 && (
              <div className="special-features">
                <h4>Special Features</h4>
                <ul className="special-features-list">
                  {structure.specialFeatures.map((feature, index) => (
                    <li key={index} className="special-feature">{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Materials tab
  const renderMaterials = () => {
    const material = parsedData.materialSpecification || {};
    const quantities = parsedData.materialQuantityEstimation || {};
    
    return (
      <div className="materials-container">
        <div className="materials-specifications">
          <h3 className="section-title">Material Specifications</h3>
          <div className="specs-grid">
            <div className="spec-group basic-specs">
              <h4 className="group-title">Basic Information</h4>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-label">Material</span>
                  <span className="spec-value">{safeGet(material, 'material')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Material Subtype</span>
                  <span className="spec-value">{safeGet(material, 'materialSubtype')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Generation</span>
                  <span className="spec-value">{safeGet(material, 'materialGeneration')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Manufacturer</span>
                  <span className="spec-value">{safeGet(material, 'manufacturer')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Product Line</span>
                  <span className="spec-value">{safeGet(material, 'productLine')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Colors</span>
                  <div className="colors-container">
                    {Array.isArray(material.colors) ? 
                      material.colors.map((color, index) => (
                        <span key={index} className="color-tag">{color}</span>
                      )) :
                      <span className="color-tag">{safeGet(material, 'colors')}</span>
                    }
                  </div>
                </div>
              </div>
            </div>
            
            <div className="spec-group physical-specs">
              <h4 className="group-title">Physical Attributes</h4>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-label">Dimensions</span>
                  <span className="spec-value">{safeGet(material, 'dimensions')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Thickness</span>
                  <span className="spec-value">{safeGet(material, 'thickness')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Weight</span>
                  <span className="spec-value">{safeGet(material, 'weight')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Pattern</span>
                  <span className="spec-value">{safeGet(material, 'pattern')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Stagger Pattern</span>
                  <span className="spec-value">{safeGet(material, 'staggerPattern')}</span>
                </div>
              </div>
            </div>
            
            <div className="spec-group performance-specs">
              <h4 className="group-title">Performance & Ratings</h4>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-label">Fire Rating</span>
                  <span className="spec-value">{safeGet(material, 'fireRating')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Wind Rating</span>
                  <span className="spec-value">{safeGet(material, 'windRating')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Impact Resistance</span>
                  <span className="spec-value">{safeGet(material, 'impactResistance')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Energy Efficiency</span>
                  <span className="spec-value">{safeGet(material, 'energyEfficiency')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Material Technology</span>
                  <span className="spec-value">{safeGet(material, 'materialTechnology')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Compliance Standards</span>
                  <span className="spec-value">{safeGet(material, 'complianceStandards')}</span>
                </div>
              </div>
            </div>
            
            <div className="spec-group lifespan-specs">
              <h4 className="group-title">Lifespan & Warranty</h4>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-label">Estimated Age</span>
                  <span className="spec-value">{safeGet(material, 'estimatedAge')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Expected Lifespan</span>
                  <span className="spec-value">{safeGet(material, 'lifespan')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Warranty</span>
                  <span className="spec-value">{safeGet(material, 'warranty')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="materials-estimation">
          <h3 className="section-title">Material Quantity Estimation</h3>
          
          <div className="materials-table-container">
            <table className="materials-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Units</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="material-row primary-row">
                  <td>Shingles (Base)</td>
                  <td>{safeGet(quantities, 'shingleSquares.value', 0)}</td>
                  <td>squares</td>
                  <td>1 square = 100 sq ft</td>
                </tr>
                <tr className="material-row adjusted-row">
                  <td>Shingles (with waste)</td>
                  <td>{safeGet(quantities, 'shingleSquares.adjustedValue', 0)}</td>
                  <td>squares</td>
                  <td>Including {safeGet(quantities, 'wastePercentage.value', '10-15')}% waste</td>
                </tr>
                <tr className="material-row">
                  <td>Underlayment</td>
                  <td>{safeGet(quantities, 'underlaymentArea.value', 0)}</td>
                  <td>sq ft</td>
                  <td>Confidence: {safeGet(quantities, 'underlaymentArea.confidenceScore', 0)}/10</td>
                </tr>
                <tr className="material-row">
                  <td>Ridge Cap</td>
                  <td>{safeGet(quantities, 'accessoryQuantities.ridgeCap', 0)}</td>
                  <td>linear ft</td>
                  <td rowSpan="4">Accessory confidence: {safeGet(quantities, 'accessoryQuantities.confidenceScore', 0)}/10</td>
                </tr>
                <tr className="material-row">
                  <td>Starter Strip</td>
                  <td>{safeGet(quantities, 'accessoryQuantities.starter', 0)}</td>
                  <td>linear ft</td>
                </tr>
                <tr className="material-row">
                  <td>Drip Edge</td>
                  <td>{safeGet(quantities, 'accessoryQuantities.drip', 0)}</td>
                  <td>linear ft</td>
                </tr>
                <tr className="material-row">
                  <td>Valley Material</td>
                  <td>{safeGet(quantities, 'accessoryQuantities.valley', 0)}</td>
                  <td>linear ft</td>
                </tr>
                <tr className="material-row">
                  <td>Step Flashing</td>
                  <td>{safeGet(quantities, 'accessoryQuantities.step', 0)}</td>
                  <td>linear ft</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Waste Factors */}
          {Array.isArray(quantities.wastePercentage?.factors) && quantities.wastePercentage.factors.length > 0 && (
            <div className="waste-factors">
              <h4>Waste Calculation Factors</h4>
              <ul className="factors-list">
                {quantities.wastePercentage.factors.map((factor, index) => (
                  <li key={index} className="factor-item">{factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Installation Quality */}
        {parsedData.installationQuality && (
          <div className="installation-quality">
            <h3 className="section-title">Installation Quality</h3>
            
            <div className="quality-metrics">
              <div className="quality-grid">
                <div className="quality-item">
                  <span className="quality-label">Alignment Quality</span>
                  <div className="quality-value-container">
                    <div className="quality-bar-container">
                      <div 
                        className="quality-bar" 
                        style={{ 
                          width: `${parsedData.installationQuality.alignmentQuality * 10}%`,
                          backgroundColor: getSeverityColor(10 - parsedData.installationQuality.alignmentQuality)
                        }}
                      ></div>
                    </div>
                    <span className="quality-value">{parsedData.installationQuality.alignmentQuality}/10</span>
                  </div>
                </div>
                
                <div className="quality-item">
                  <span className="quality-label">Exposure Consistency</span>
                  <span className="quality-value">{parsedData.installationQuality.exposureConsistency}</span>
                </div>
                
                <div className="quality-item">
                  <span className="quality-label">Valley Installation</span>
                  <span className="quality-value">{parsedData.installationQuality.valleyInstallation}</span>
                </div>
                
                <div className="quality-item">
                  <span className="quality-label">Flashing Installation</span>
                  <span className="quality-value">{parsedData.installationQuality.flashingInstallation}</span>
                </div>
                
                <div className="quality-item">
                  <span className="quality-label">Ridge Cap Installation</span>
                  <span className="quality-value">{parsedData.installationQuality.ridgeCapInstallation}</span>
                </div>
                
                <div className="quality-item">
                  <span className="quality-label">Nailing Pattern</span>
                  <span className="quality-value">{parsedData.installationQuality.nailingPattern}</span>
                </div>
                
                <div className="quality-item overall">
                  <span className="quality-label">Overall Workmanship</span>
                  <div className="quality-value-container">
                    <div className="quality-bar-container">
                      <div 
                        className="quality-bar" 
                        style={{ 
                          width: `${parsedData.installationQuality.overallWorkmanship * 10}%`,
                          backgroundColor: getSeverityColor(10 - parsedData.installationQuality.overallWorkmanship)
                        }}
                      ></div>
                    </div>
                    <span className="quality-value">{parsedData.installationQuality.overallWorkmanship}/10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Damage tab
  const renderDamage = () => {
    const damage = parsedData.damageAssessment || {};
    
    return (
      <div className="damage-container">
        <div className="damage-assessment-header">
          <div className="damage-condition">
            <h3>Overall Condition</h3>
            <div className={`condition-badge condition-${(damage.overallCondition || '').toLowerCase()}`}>
              {safeGet(damage, 'overallCondition', 'Unknown')}
            </div>
          </div>
          
          <div className="damage-severity-container">
            <h3>Damage Severity</h3>
            <div className="severity-meter-container">
              <div className="severity-meter">
                <div 
                  className="severity-fill" 
                  style={{ 
                    width: `${Math.min(100, (damage.damageSeverity || 0) * 10)}%`,
                    backgroundColor: getSeverityColor(damage.damageSeverity || 0)
                  }}
                ></div>
              </div>
              <div className="severity-value">{damage.damageSeverity || 0}/10</div>
            </div>
          </div>
        </div>
        
        {/* Damage Types */}
        <div className="damage-types-section">
          <h3>Detected Issues</h3>
          
          <div className="damage-types-grid">
            {Array.isArray(damage.damageTypes) && damage.damageTypes.map((type, index) => (
              <div key={index} className="damage-type-tag">{type}</div>
            ))}
          </div>
          
          {damage.description && (
            <div className="damage-description">
              <h4>Description</h4>
              <p>{damage.description}</p>
            </div>
          )}
        </div>
        
        {/* Detailed Damage Assessment */}
        <div className="detailed-damage-section">
          <h3>Detailed Damage Assessment</h3>
          
          <div className="damage-details-grid">
            {/* Render each damage type that is present */}
            {damage.granuleLoss?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Granule Loss</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.granuleLoss.severity) }}>
                    {damage.granuleLoss.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.granuleLoss.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.granuleLoss.description}</p>
                </div>
              </div>
            )}
            
            {damage.cracking?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Cracking</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.cracking.severity) }}>
                    {damage.cracking.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.cracking.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.cracking.description}</p>
                </div>
              </div>
            )}
            
            {damage.curling?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Curling</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.curling.severity) }}>
                    {damage.curling.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.curling.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.curling.description}</p>
                </div>
              </div>
            )}
            
            {damage.blistering?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Blistering</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.blistering.severity) }}>
                    {damage.blistering.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.blistering.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.blistering.description}</p>
                </div>
              </div>
            )}
            
            {damage.missingShingles?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Missing Shingles</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.missingShingles.severity) }}>
                    {damage.missingShingles.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.missingShingles.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.missingShingles.description}</p>
                </div>
              </div>
            )}
            
            {damage.hailDamage?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Hail Damage</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.hailDamage.severity) }}>
                    {damage.hailDamage.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.hailDamage.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.hailDamage.description}</p>
                  {damage.hailDamage.impactDensity && (
                    <div className="impact-density">
                      <span className="density-label">Impact Density:</span>
                      <span className="density-value">{damage.hailDamage.impactDensity} impacts per 100 sq ft</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {damage.waterDamage?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Water Damage</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.waterDamage.severity) }}>
                    {damage.waterDamage.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.waterDamage.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.waterDamage.description}</p>
                </div>
              </div>
            )}
            
            {damage.algaeGrowth?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Algae Growth</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.algaeGrowth.severity) }}>
                    {damage.algaeGrowth.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.algaeGrowth.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.algaeGrowth.description}</p>
                </div>
              </div>
            )}
            
            {damage.mossGrowth?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Moss Growth</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.mossGrowth.severity) }}>
                    {damage.mossGrowth.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.mossGrowth.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.mossGrowth.description}</p>
                </div>
              </div>
            )}
            
            {damage.uvDegradation?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>UV Degradation</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.uvDegradation.severity) }}>
                    {damage.uvDegradation.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.uvDegradation.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.uvDegradation.description}</p>
                </div>
              </div>
            )}
            
            {damage.sealingFailure?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Sealing Failure</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.sealingFailure.severity) }}>
                    {damage.sealingFailure.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Coverage:</span>
                    <span className="coverage-value">{damage.sealingFailure.coverage}%</span>
                  </div>
                  <p className="damage-detail-description">{damage.sealingFailure.description}</p>
                </div>
              </div>
            )}
            
            {damage.nailPops?.present && (
              <div className="damage-detail-card">
                <div className="damage-detail-header">
                  <h4>Nail Pops</h4>
                  <div className="damage-severity-badge" style={{ backgroundColor: getSeverityColor(damage.nailPops.severity) }}>
                    {damage.nailPops.severity}/10
                  </div>
                </div>
                <div className="damage-detail-content">
                  <div className="damage-coverage">
                    <span className="coverage-label">Count:</span>
                    <span className="coverage-value">{damage.nailPops.count} nail pops</span>
                  </div>
                  <p className="damage-detail-description">{damage.nailPops.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Damage Information */}
        <div className="damage-information-section">
          <div className="damage-info-cards">
            {/* Flashing Condition */}
            {damage.flashingCondition && (
              <div className="damage-info-card">
                <h4>Flashing Condition</h4>
                <div className="condition-badge flashing-condition">
                  {damage.flashingCondition.condition || 'Unknown'}
                </div>
                <p>{damage.flashingCondition.description}</p>
                {Array.isArray(damage.flashingCondition.issues) && damage.flashingCondition.issues.length > 0 && (
                  <div className="flashing-issues">
                    <h5>Issues:</h5>
                    <ul>
                      {damage.flashingCondition.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {/* Valley Damage */}
            {damage.valleyDamage?.present && (
              <div className="damage-info-card">
                <h4>Valley Damage</h4>
                <div className="severity-indicator">
                  Severity: {damage.valleyDamage.severity}/10
                </div>
                <p>{damage.valleyDamage.description}</p>
              </div>
            )}
            
            {/* Ridge Cap Condition */}
            {damage.ridgeCapCondition && (
              <div className="damage-info-card">
                <h4>Ridge Cap Condition</h4>
                <div className="condition-badge ridge-cap-condition">
                  {damage.ridgeCapCondition.condition || 'Unknown'}
                </div>
                <p>{damage.ridgeCapCondition.description}</p>
              </div>
            )}
          </div>
          
          {/* Likely Damage Causes */}
          {Array.isArray(damage.likelyDamageCauses) && damage.likelyDamageCauses.length > 0 && (
            <div className="damage-causes">
              <h4>Likely Damage Causes</h4>
              <div className="causes-grid">
                {damage.likelyDamageCauses.map((cause, index) => (
                  <div key={index} className="cause-tag">{cause}</div>
                ))}
              </div>
            </div>
          )}
          
          {/* Additional Damage Information */}
          <div className="additional-damage-info">
            {damage.estimatedTimeframeSinceDamage && (
              <div className="damage-timeframe">
                <h4>Estimated Timeframe Since Damage</h4>
                <p>{damage.estimatedTimeframeSinceDamage}</p>
              </div>
            )}
            
            <div className="damage-properties">
              <div className="damage-property">
                <span className="property-label">Weather Related:</span>
                <span className={`property-value ${damage.weatherRelated ? 'positive' : 'negative'}`}>
                  {damage.weatherRelated ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="damage-property">
                <span className="property-label">Structural Concerns:</span>
                <span className={`property-value ${damage.structuralConcerns ? 'negative' : 'positive'}`}>
                  {damage.structuralConcerns ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="damage-property">
                <span className="property-label">Progressive Issues:</span>
                <span className={`property-value ${damage.progressiveIssues ? 'negative' : 'positive'}`}>
                  {damage.progressiveIssues ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recommended Action */}
        <div className="recommended-action-section">
          <h3>Recommended Action</h3>
          <div className="action-content">
            <p>{damage.recommendedAction || 'No specific recommendations provided.'}</p>
          </div>
        </div>
      </div>
    );
  };

  // Repair tab
  const renderRepair = () => {
    const repair = parsedData.repairAssessment || {};
    const emergency = parsedData.emergencyAssessment || {};
    
    return (
      <div className="repair-container">
        <div className="repair-recommendation-header">
          <div className="recommendation-primary">
            <h3>Recommendation</h3>
            <div className={`recommendation-badge recommendation-${(repair.repairRecommendation || '').toLowerCase().replace(/\s+/g, '-')}`}>
              {safeGet(repair, 'repairRecommendation', 'Unknown')}
            </div>
          </div>
          
          <div className="urgency-container">
            <h3>Urgency</h3>
         <div className={`urgency-badge urgency-${(repair.urgency || '').toLowerCase()}`}>
              {safeGet(repair, 'urgency', 'Unknown')}
            </div>
          </div>
        </div>
        
        <div className="repair-assessment-grid">
          <div className="repair-card difficulty-card">
            <h4>Repair Difficulty</h4>
            <div className="difficulty-value">
              {safeGet(repair, 'repairDifficulty', 'Unknown')}
            </div>
            <div className="diy-feasibility">
              <span className="diy-label">DIY Feasible:</span>
              <span className="diy-value">{repair.diyFeasibility ? 'Yes' : 'No'}</span>
            </div>
          </div>
          
          <div className="repair-card cost-card">
            <h4>Cost Estimates</h4>
            <div className="cost-items">
              <div className="cost-item">
                <span className="cost-label">Repair Cost</span>
                <span className="cost-value">{safeGet(repair, 'anticipatedRepairCost', 'Unknown')}</span>
              </div>
              
              <div className="cost-item">
                <span className="cost-label">Replacement Cost</span>
                <span className="cost-value">{safeGet(repair, 'anticipatedReplacementCost', 'Unknown')}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Special Considerations */}
        {Array.isArray(repair.specialConsiderations) && repair.specialConsiderations.length > 0 && (
          <div className="special-considerations">
            <h3>Special Considerations</h3>
            <ul className="considerations-list">
              {repair.specialConsiderations.map((consideration, index) => (
                <li key={index} className="consideration-item">{consideration}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Emergency Assessment */}
        {emergency.emergencyIssuesDetected && (
          <div className="emergency-assessment">
            <h3>Emergency Issues</h3>
            <div className="emergency-alert">
              <span className="emergency-icon">🚨</span>
              <span className="emergency-text">Emergency issues detected</span>
            </div>
            
            {Array.isArray(emergency.immediateConcerns) && emergency.immediateConcerns.length > 0 && (
              <div className="immediate-concerns">
                <h4>Immediate Concerns</h4>
                <ul className="concerns-list">
                  {emergency.immediateConcerns.map((concern, index) => (
                    <li key={index} className="concern-item">{concern}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {emergency.safetyRisks && (
              <div className="safety-risks">
                <h4>Safety Risks</h4>
                <p>{emergency.safetyRisks}</p>
              </div>
            )}
            
            {emergency.recommendedTimeframe && (
              <div className="timeframe-recommendation">
                <h4>Recommended Timeframe</h4>
                <p>{emergency.recommendedTimeframe}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Historical Analysis */}
        {parsedData.historicalAnalysis && (
          <div className="historical-analysis">
            <h3>Historical Analysis</h3>
            
            <div className="history-grid">
              {parsedData.historicalAnalysis.previousRepairs?.evidence && (
                <div className="history-card">
                  <h4>Previous Repairs</h4>
                  <div className="history-content">
                    <p>{parsedData.historicalAnalysis.previousRepairs.evidence}</p>
                    
                    {Array.isArray(parsedData.historicalAnalysis.previousRepairs.locations) && (
                      <div className="history-locations">
                        <span className="locations-label">Locations:</span>
                        <div className="locations-list">
                          {parsedData.historicalAnalysis.previousRepairs.locations.map((location, index) => (
                            <span key={index} className="location-tag">{location}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {parsedData.historicalAnalysis.previousRepairs.quality && (
                      <div className="repair-quality">
                        <span className="quality-label">Quality:</span>
                        <span className="quality-value">{parsedData.historicalAnalysis.previousRepairs.quality}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {parsedData.historicalAnalysis.previousReplacements?.evidence && (
                <div className="history-card">
                  <h4>Previous Replacements</h4>
                  <div className="history-content">
                    <p>{parsedData.historicalAnalysis.previousReplacements.evidence}</p>
                    
                    {Array.isArray(parsedData.historicalAnalysis.previousReplacements.sections) && (
                      <div className="history-sections">
                        <span className="sections-label">Sections:</span>
                        <div className="sections-list">
                          {parsedData.historicalAnalysis.previousReplacements.sections.map((section, index) => (
                            <span key={index} className="section-tag">{section}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {parsedData.historicalAnalysis.layering?.evidence && (
                <div className="history-card">
                  <h4>Roof Layering</h4>
                  <div className="history-content">
                    <p>{parsedData.historicalAnalysis.layering.evidence}</p>
                    
                    {parsedData.historicalAnalysis.layering.estimatedLayers && (
                      <div className="layers-count">
                        <span className="layers-label">Estimated Layers:</span>
                        <span className="layers-value">{parsedData.historicalAnalysis.layering.estimatedLayers}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {parsedData.historicalAnalysis.ageConsistency && (
                <div className="history-card">
                  <h4>Age Consistency</h4>
                  <div className="history-content">
                    <div className="consistency-indicator">
                      <span className="consistency-label">Consistent Age:</span>
                      <span className="consistency-value">
                        {parsedData.historicalAnalysis.ageConsistency.isConsistent ? 'Yes' : 'No'}
                      </span>
                    </div>
                    
                    {parsedData.historicalAnalysis.ageConsistency.variations && (
                      <p>{parsedData.historicalAnalysis.ageConsistency.variations}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Metadata tab
  const renderMetadata = () => {
    const metadata = parsedData.metadata || {};
    const multiImageData = parsedData.multiImageIntegration || {};
    
    return (
      <div className="metadata-container">
        <div className="metadata-grid">
          <div className="metadata-card confidence-card">
            <h4>Analysis Confidence</h4>
            <div className="confidence-meter">
              <div 
                className="confidence-fill" 
                style={{ width: `${(metadata.confidenceScore || 0) * 10}%` }}
              ></div>
              <span className="confidence-value">{metadata.confidenceScore || 0}/10</span>
            </div>
            
            <div className="metadata-details">
              <div className="metadata-item">
                <span className="metadata-label">Visibility Quality</span>
                <span className="metadata-value">{safeGet(metadata, 'visibilityQuality', 'Unknown')}</span>
              </div>
              
              <div className="metadata-item">
                <span className="metadata-label">Visible Portion</span>
                <span className="metadata-value">{safeGet(metadata, 'visibleSectionEstimate', 'Unknown')}</span>
              </div>
              
              <div className="metadata-item">
                <span className="metadata-label">Additional Inspection</span>
                <span className="metadata-value">{metadata.additionalInspectionNeeded ? 'Recommended' : 'Not Required'}</span>
              </div>
            </div>
            
            {metadata.limitationNotes && (
              <div className="limitations">
                <h5>Limitations</h5>
                <p>{metadata.limitationNotes}</p>
              </div>
            )}
          </div>
          
          {/* Multi-Image Integration */}
          {multiImageData.imageAlignment && (
            <div className="metadata-card multi-image-card">
              <h4>Multi-Image Analysis</h4>
              
              <div className="metadata-details">
                <div className="metadata-item">
                  <span className="metadata-label">Images Analyzed</span>
                  <span className="metadata-value">{results.imageCount || '?'}</span>
                </div>
                
                <div className="metadata-item">
                  <span className="metadata-label">Matched Points</span>
                  <span className="metadata-value">{safeGet(multiImageData, 'imageAlignment.matchedPoints', 'Unknown')}</span>
                </div>
                
                <div className="metadata-item">
                  <span className="metadata-label">Alignment Quality</span>
                  <span className="metadata-value">{safeGet(multiImageData, 'imageAlignment.alignmentQuality', 0)}/10</span>
                </div>
                
                <div className="metadata-item">
                  <span className="metadata-label">Measurement Consistency</span>
                  <span className="metadata-value">{safeGet(multiImageData, 'measurementConsistency.overallConsistency', 0)}/10</span>
                </div>
              </div>
              
              {multiImageData.compositeModel && (
                <div className="composite-model">
                  <h5>Composite Model</h5>
                  <div className="metadata-item">
                    <span className="metadata-label">Completeness</span>
                    <span className="metadata-value">{multiImageData.compositeModel.completeness}/10</span>
                  </div>
                  
                  {multiImageData.compositeModel.missingAreas && (
                    <div className="missing-areas">
                      <span className="areas-label">Missing Areas:</span>
                      <p>{multiImageData.compositeModel.missingAreas}</p>
                    </div>
                  )}
                </div>
              )}
              
              {multiImageData.imageAlignment.coverageMap && (
                <div className="coverage-map">
                  <h5>Coverage Map</h5>
                  <p>{multiImageData.imageAlignment.coverageMap}</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Raw Model Response */}
        <div className="raw-response-section">
          <h4>Raw API Response</h4>
          <div className="raw-toggle">
            <button className="toggle-button" onClick={() => document.getElementById('raw-data').classList.toggle('expanded')}>
              Show/Hide Raw Data
            </button>
          </div>
          <div id="raw-data" className="raw-data">
            <pre>{JSON.stringify(parsedData, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="advanced-results-container">
      <div className="results-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'measurements' ? 'active' : ''}`}
          onClick={() => setActiveTab('measurements')}
        >
          Measurements
        </button>
        <button 
          className={`tab-button ${activeTab === 'structure' ? 'active' : ''}`}
          onClick={() => setActiveTab('structure')}
        >
          Structure
        </button>
        <button 
          className={`tab-button ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          Materials
        </button>
        <button 
          className={`tab-button ${activeTab === 'damage' ? 'active' : ''}`}
          onClick={() => setActiveTab('damage')}
        >
          Damage
        </button>
        <button 
          className={`tab-button ${activeTab === 'repair' ? 'active' : ''}`}
          onClick={() => setActiveTab('repair')}
        >
          Repair
        </button>
        <button 
          className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Metadata
        </button>
      </div>
      
      <div className="results-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'measurements' && renderMeasurements()}
        {activeTab === 'structure' && renderStructure()}
        {activeTab === 'materials' && renderMaterials()}
        {activeTab === 'damage' && renderDamage()}
        {activeTab === 'repair' && renderRepair()}
        {activeTab === 'metadata' && renderMetadata()}
      </div>
    </div>
  );
};

export default AdvancedResultsDisplay;
