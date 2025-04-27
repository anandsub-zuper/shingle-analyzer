// src/components/CostEstimation.jsx
import React, { useMemo } from 'react';

const CostEstimation = ({ damageData }) => {
  // Calculate cost estimate based on damage assessment data
  const costEstimate = useMemo(() => {
    if (!damageData) return { min: 0, max: 0, details: [] };
    
    // Base repair costs by damage type (2025 data)
    const repairCostsByType = {
      'missing shingles': { min: 150, max: 550, unit: 'per area' },
      'damaged shingles': { min: 360, max: 1830, unit: 'total' },
      'curling shingles': { min: 350, max: 800, unit: 'total' },
      'granule loss': { min: 400, max: 1200, unit: 'total' },
      'cracked shingles': { min: 350, max: 1000, unit: 'total' },
      'lifted shingles': { min: 300, max: 800, unit: 'total' },
      'water damage': { min: 800, max: 2500, unit: 'total' },
      'moss growth': { min: 250, max: 600, unit: 'total' },
      'algae growth': { min: 250, max: 600, unit: 'total' },
      'flashing issues': { min: 200, max: 500, unit: 'total' },
      'leak': { min: 350, max: 1000, unit: 'total' },
      'hail damage': { min: 700, max: 4000, unit: 'total' },
      'structural damage': { min: 1500, max: 7000, unit: 'total' },
      'sagging': { min: 1500, max: 7000, unit: 'total' },
      'rot': { min: 800, max: 3000, unit: 'total' },
      'puncture': { min: 150, max: 800, unit: 'total' },
      'blistering': { min: 400, max: 1200, unit: 'total' },
      'storm damage': { min: 700, max: 3000, unit: 'total' },
      'wind damage': { min: 500, max: 2000, unit: 'total' },
      'ridge cap damage': { min: 250, max: 750, unit: 'total' },
      'ventilation issues': { min: 300, max: 1000, unit: 'total' }
    };

    // Calculate minimum and maximum estimates based on damage types
    let foundDamageTypes = 0;
    let minTotal = 0;
    let maxTotal = 0;
    
    // If no specific damage types are found, use overall condition
    if (!damageData.damageTypes || damageData.damageTypes.length === 0) {
      switch(damageData.overallCondition?.toLowerCase() || 'unknown') {
        case 'excellent':
          return { min: 0, max: 0, details: [] };
        case 'good':
          return { min: 150, max: 500, details: [{ type: 'minor repairs', min: 150, max: 500 }] };
        case 'fair':
          return { min: 800, max: 2000, details: [{ type: 'moderate repairs', min: 800, max: 2000 }] };
        case 'poor':
          return { min: 2000, max: 8000, details: [{ type: 'major repairs', min: 2000, max: 8000 }] };
        default:
          return { min: 400, max: 1500, details: [{ type: 'general repairs', min: 400, max: 1500 }] };
      }
    }
    
    // Calculate based on specific damage types
    const costDetails = [];
    damageData.damageTypes.forEach(damageType => {
      // Convert damage type to lowercase for matching
      const lowerDamageType = damageType.toLowerCase();
      
      // Find matching damage type in our cost database
      let matchFound = false;
      for (const [key, costRange] of Object.entries(repairCostsByType)) {
        if (lowerDamageType.includes(key)) {
          // Apply severity multiplier (1.0 for severity 5, scale up or down)
          const severityMultiplier = damageData.severity ? (damageData.severity / 5) : 1.0;
          const adjustedMin = Math.round(costRange.min * severityMultiplier);
          const adjustedMax = Math.round(costRange.max * severityMultiplier);
          
          minTotal += adjustedMin;
          maxTotal += adjustedMax;
          foundDamageTypes++;
          
          costDetails.push({
            type: damageType,
            min: adjustedMin,
            max: adjustedMax
          });
          
          matchFound = true;
          break;
        }
      }
      
      // If no match found, use generic estimate
      if (!matchFound) {
        const genericMin = 300;
        const genericMax = 1000;
        minTotal += genericMin;
        maxTotal += genericMax;
        foundDamageTypes++;
        
        costDetails.push({
          type: damageType,
          min: genericMin,
          max: genericMax
        });
      }
    });
    
    // Adjust for overlap in repairs (multiple damage types may be fixed in one repair)
    if (foundDamageTypes > 1) {
      const overlapDiscount = 0.15; // 15% discount for overlap
      minTotal = Math.round(minTotal * (1 - (overlapDiscount * (foundDamageTypes - 1))));
      maxTotal = Math.round(maxTotal * (1 - (overlapDiscount * (foundDamageTypes - 1))));
    }
    
    return {
      min: minTotal,
      max: maxTotal,
      details: costDetails
    };
  }, [damageData]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!damageData) return null;

  // No need to show cost estimate if there's no damage
  if (costEstimate.min === 0 && costEstimate.max === 0) {
    return (
      <div className="cost-estimation">
        <h3 className="cost-header">Cost Estimation</h3>
        <p className="no-cost-message">No repairs needed. No cost estimate provided.</p>
      </div>
    );
  }

  return (
    <div className="cost-estimation">
      <h3 className="cost-header">Cost Estimation</h3>
      
      <div className="cost-range">
        <span className="cost-label">Estimated repair cost:</span>
        <span className="cost-value">{formatCurrency(costEstimate.min)} - {formatCurrency(costEstimate.max)}</span>
      </div>
      
      <div className="cost-disclaimer">
        <p>This is an automated estimate based on 2025 national average repair costs. Actual costs may vary based on your location, contractor rates, and the specific details of your roof.</p>
      </div>
      
      {costEstimate.details && costEstimate.details.length > 0 && (
        <div className="cost-breakdown">
          <h4>Cost Breakdown</h4>
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Estimated Range</th>
              </tr>
            </thead>
            <tbody>
              {costEstimate.details.map((detail, index) => (
                <tr key={index}>
                  <td>{detail.type}</td>
                  <td>{formatCurrency(detail.min)} - {formatCurrency(detail.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="repair-recommendations">
        <h4>Repair Recommendations</h4>
        <p>{damageData.recommendedAction || "Contact a professional roofer for an accurate assessment and quote."}</p>
        
        {costEstimate.max > 5000 && (
          <div className="repair-vs-replace">
            <p className="replace-note">
              Note: If repairs exceed $5,000-$8,000, you may want to consider a full roof replacement instead, especially if your roof is over 15 years old.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostEstimation;
