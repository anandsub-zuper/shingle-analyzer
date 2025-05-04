// src/components/insurance/ReportPreview.jsx
import React from 'react';
import '../../styles/ReportPreview.css';

// Format currency
const formatCurrency = (amount) => {
  if (!amount || isNaN(parseFloat(amount))) return 'Unknown';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(parseFloat(amount));
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Return safe value with fallback
const safeValue = (value, fallback = 'Unknown') => {
  return value !== undefined && value !== null ? value : fallback;
};

const ReportPreview = ({ data }) => {
  const {
    policyholderInfo,
    propertyInfo,
    damageAssessment,
    materialSpecs,
    costEstimates,
    generatedDate,
    imageData
  } = data;
  
  // Get damage types as an array
  const damageTypes = Array.isArray(damageAssessment?.damageTypes) 
    ? damageAssessment.damageTypes 
    : (damageAssessment?.damageTypes ? [damageAssessment.damageTypes] : []);
  
  return (
    <div className="report-preview">
      <div className="preview-header">
        <h3 className="preview-title">Report Preview</h3>
        <p className="preview-subtitle">
          Review the information before generating the final report
        </p>
      </div>
      
      <div className="preview-content">
        {/* Header Section */}
        <div className="preview-section header-preview">
          <h2 className="report-heading">Roof Damage Assessment Report</h2>
          <p className="report-subheading">Professional Analysis for Insurance Claim</p>
          <p className="report-date">Generated on: {formatDate(generatedDate)}</p>
        </div>
        
        {/* Two-column layout for property and policyholder info */}
        <div className="preview-columns">
          {/* Left Column: Policyholder Information */}
          <div className="preview-column">
            <div className="preview-section">
              <h3 className="section-title">Policyholder Information</h3>
              
              <div className="info-item">
                <span className="info-label">Policyholder Name:</span>
                <span className="info-value">{safeValue(policyholderInfo?.name)}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">Insurance Company:</span>
                <span className="info-value">{safeValue(policyholderInfo?.insuranceCompany)}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">Policy Number:</span>
                <span className="info-value">{safeValue(policyholderInfo?.policyNumber)}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">Claim Number:</span>
                <span className="info-value">{safeValue(policyholderInfo?.claimNumber)}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">Date of Damage:</span>
                <span className="info-value">{formatDate(policyholderInfo?.dateOfDamage)}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">Contact Information:</span>
                <span className="info-value">
                  {safeValue(policyholderInfo?.contactPhone)}
                  {policyholderInfo?.contactEmail ? ` • ${policyholderInfo.contactEmail}` : ''}
                </span>
              </div>
            </div>
          </div>
          
          {/* Right Column: Property Information */}
          <div className="preview-column">
            <div className="preview-section">
              <h3 className="section-title">Property Information</h3>
              
              <div className="info-item">
                <span className="info-label">Property Address:</span>
                <span className="info-value">{safeValue(policyholderInfo?.address)}</span>
              </div>
              
              {propertyInfo && (
                <>
                  <div className="info-item">
                    <span className="info-label">Property Type:</span>
                    <span className="info-value">{safeValue(propertyInfo?.details?.propertyType)}</span>
                  </div>
                  
                  <div className="info-item">
                    <span className="info-label">Year Built:</span>
                    <span className="info-value">{safeValue(propertyInfo?.details?.yearBuilt)}</span>
                  </div>
                  
                  <div className="info-item">
                    <span className="info-label">Square Footage:</span>
                    <span className="info-value">
                      {propertyInfo?.details?.squareFootage 
                        ? `${propertyInfo.details.squareFootage.toLocaleString()} sq ft` 
                        : 'Unknown'
                      }
                    </span>
                  </div>
                  
                  <div className="info-item">
                    <span className="info-label">Estimated Value:</span>
                    <span className="info-value">
                      {propertyInfo?.valuation?.estimatedValue 
                        ? formatCurrency(propertyInfo.valuation.estimatedValue) 
                        : 'Unknown'
                      }
                    </span>
                  </div>
                </>
              )}
            </div>
            
            <div className="property-image">
              {imageData && (
                <img 
                  src={`data:image/jpeg;base64,${imageData}`} 
                  alt="Property Roof" 
                  className="roof-image"
                />
              )}
              <span className="image-caption">Roof Analysis Image</span>
            </div>
          </div>
        </div>
        
        {/* Damage Assessment Section */}
        <div className="preview-section">
          <h3 className="section-title">Damage Assessment</h3>
          
          <div className="damage-overview">
            {damageAssessment?.overallCondition && (
              <div className={`condition-badge condition-${damageAssessment.overallCondition.toLowerCase()}`}>
                Condition: {damageAssessment.overallCondition}
              </div>
            )}
            
            {damageAssessment?.damageSeverity && (
              <div className="severity-meter">
                <span className="severity-label">Damage Severity:</span>
                <div className="severity-bar-container">
                  <div 
                    className="severity-bar" 
                    style={{ 
                      width: `${damageAssessment.damageSeverity * 10}%`,
                      backgroundColor: getSeverityColor(damageAssessment.damageSeverity)
                    }}
                  ></div>
                  <span className="severity-value">{damageAssessment.damageSeverity}/10</span>
                </div>
              </div>
            )}
          </div>
          
          {damageTypes.length > 0 && (
            <div className="damage-types">
              <h4 className="subsection-title">Detected Damage Types</h4>
              <div className="damage-tags">
                {damageTypes.map((type, index) => (
                  <span key={index} className="damage-tag">{type}</span>
                ))}
              </div>
            </div>
          )}
          
          {damageAssessment?.description && (
            <div className="damage-description">
              <h4 className="subsection-title">Damage Description</h4>
              <p>{damageAssessment.description}</p>
            </div>
          )}
          
          {damageAssessment?.likelyDamageCauses && (
            <div className="damage-causes">
              <h4 className="subsection-title">Likely Causes</h4>
              <p>
                {Array.isArray(damageAssessment.likelyDamageCauses) 
                  ? damageAssessment.likelyDamageCauses.join(', ')
                  : damageAssessment.likelyDamageCauses
                }
              </p>
            </div>
          )}
        </div>
        
        {/* Material Specifications Section */}
        <div className="preview-section">
          <h3 className="section-title">Material Specifications</h3>
          
          <div className="material-specs-grid">
            <div className="spec-item">
              <span className="spec-label">Material Type</span>
              <span className="spec-value">{safeValue(materialSpecs?.material)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Manufacturer</span>
              <span className="spec-value">{safeValue(materialSpecs?.manufacturer)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Product Line</span>
              <span className="spec-value">{safeValue(materialSpecs?.productLine)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Estimated Age</span>
              <span className="spec-value">{safeValue(materialSpecs?.estimatedAge)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Expected Lifespan</span>
              <span className="spec-value">{safeValue(materialSpecs?.lifespan)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Dimensions</span>
              <span className="spec-value">{safeValue(materialSpecs?.dimensions)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Thickness</span>
              <span className="spec-value">{safeValue(materialSpecs?.thickness)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Warranty</span>
              <span className="spec-value">{safeValue(materialSpecs?.warranty)}</span>
            </div>
            
            <div className="spec-item">
              <span className="spec-label">Material Weight</span>
              <span className="spec-value">{safeValue(materialSpecs?.weight)}</span>
            </div>
          </div>
        </div>
        
        {/* Cost Estimation Section */}
        <div className="preview-section">
          <h3 className="section-title">Cost Estimation</h3>
          
          <div className="cost-estimate-overview">
            <div className="cost-item">
              <span className="cost-label">Repair Cost Estimate:</span>
              <span className="cost-value">{formatCurrency(costEstimates?.repair)}</span>
            </div>
            
            <div className="cost-item">
              <span className="cost-label">Replacement Cost Estimate:</span>
              <span className="cost-value">{formatCurrency(costEstimates?.replacement)}</span>
            </div>
          </div>
          
          {costEstimates?.details && costEstimates.details.length > 0 && (
            <div className="cost-breakdown">
              <h4 className="subsection-title">Cost Breakdown</h4>
              <table className="cost-table">
                <thead>
                  <tr>
                    <th className="issue-column">Damage Type</th>
                    <th className="cost-column">Estimated Cost Range</th>
                  </tr>
                </thead>
                <tbody>
                  {costEstimates.details.map((detail, index) => (
                    <tr key={index}>
                      <td className="issue-cell">{detail.type}</td>
                      <td className="cost-cell">
                        {formatCurrency(detail.min)} - {formatCurrency(detail.max)}
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="issue-cell">Total Estimated Cost</td>
                    <td className="cost-cell">{formatCurrency(costEstimates.repair)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Recommendations Section */}
        {damageAssessment?.recommendedAction && (
          <div className="preview-section">
            <h3 className="section-title">Recommendations</h3>
            <div className="recommendation-box">
              <h4 className="recommendation-title">Recommended Action</h4>
              <p className="recommendation-text">{damageAssessment.recommendedAction}</p>
            </div>
          </div>
        )}
        
        {/* Certification Section */}
        <div className="preview-section certification-section">
          <p className="disclaimer">
            This report is generated based on AI-powered visual analysis of the provided roof images.
            While our system uses advanced technology to assess damage and estimate costs, we recommend verification
            by a licensed roofing professional before making final repair decisions. Cost estimates are based on
            national averages and may vary by region, contractor, and specific circumstances.
          </p>
          
          <p className="report-signature">
            Generated on {formatDate(generatedDate)} by Roof Analyzer AI
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper function to get severity color
const getSeverityColor = (severity) => {
  if (severity <= 3) return '#06d6a0'; // Low - Green
  if (severity <= 6) return '#ffca3a'; // Medium - Yellow
  if (severity <= 8) return '#ff9f1c'; // High - Orange
  return '#ef476f'; // Critical - Red
};

export default ReportPreview;
