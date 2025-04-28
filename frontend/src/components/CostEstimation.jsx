// src/components/CostEstimation.jsx
import React, { useMemo } from 'react';

const CostEstimation = ({ damageData }) => {
  // Calculate cost estimate based on damage assessment data and roof measurements
  const costEstimate = useMemo(() => {
    if (!damageData) return { min: 0, max: 0, details: [] };
    
    // Extract roof measurements if available
    const roofMeasurements = damageData.roofMeasurements;
    const roofArea = roofMeasurements?.area?.total || 0;
    
    // Base repair costs by damage type (2025 data)
    const repairCostsByType = {
      'missing shingles': { min: 150, max: 550, unit: 'per area' },
      'damaged shingles': { min: 360, max: 1830, unit: 'total' },
      'curling shingles': { min: 350, max: 800, unit: 'total' },
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
      'ventilation issues': { min: 300, max: 1000, unit: 'total' },
      'granule loss': { min: 400, max: 1200, unit: 'total' },
      'cracking': { min: 350, max: 1000, unit: 'total' },
      'curling': { min: 350, max: 800, unit: 'total' }
    };

    // Calculate minimum and maximum estimates based on damage types
    let foundDamageTypes = 0;
    let minTotal = 0;
    let maxTotal = 0;
    
    // If no specific damage types are found, use overall condition
    if (!damageData.damageTypes || damageData.damageTypes.length === 0) {
      let baseEstimate = { min: 0, max: 0, details: [] };
      
      switch(damageData.overallCondition?.toLowerCase() || 'unknown') {
        case 'excellent':
          baseEstimate = { min: 0, max: 0, details: [] };
          break;
        case 'good':
          baseEstimate = { min: 150, max: 500, details: [{ type: 'minor repairs', min: 150, max: 500 }] };
          break;
        case 'fair':
          baseEstimate = { min: 800, max: 2000, details: [{ type: 'moderate repairs', min: 800, max: 2000 }] };
          break;
        case 'poor':
          baseEstimate = { min: 2000, max: 8000, details: [{ type: 'major repairs', min: 2000, max: 8000 }] };
          break;
        default:
          baseEstimate = { min: 400, max: 1500, details: [{ type: 'general repairs', min: 400, max: 1500 }] };
      }
      
      // Apply roof area adjustment if available
      if (roofArea > 0) {
        const areaSizeFactor = calculateAreaFactor(roofArea);
        return {
          min: Math.round(baseEstimate.min * areaSizeFactor),
          max: Math.round(baseEstimate.max * areaSizeFactor),
          details: baseEstimate.details,
          roofArea
        };
      }
      
      return baseEstimate;
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
          
          // Calculate costs based on whether we're using real roof measurements
          let adjustedMin, adjustedMax;
          
          if (roofArea > 0 && costRange.unit === 'per area') {
            // For 'per area' costs, calculate based on actual roof area
            // Assume the cost is per 100 sq ft, and apply to the affected area
            // Assume 10% of the roof is affected for each detected damage type
            const affectedArea = roofArea * 0.1;
            const areaUnits = affectedArea / 100;
            adjustedMin = Math.round(costRange.min * areaUnits * severityMultiplier);
            adjustedMax = Math.round(costRange.max * areaUnits * severityMultiplier);
          } else {
            // For flat costs, apply severity multiplier only
            adjustedMin = Math.round(costRange.min * severityMultiplier);
            adjustedMax = Math.round(costRange.max * severityMultiplier);
          }
          
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
    
    // Apply overall roof size adjustment if we have measurements
    if (roofArea > 0) {
      const areaSizeFactor = calculateAreaFactor(roofArea);
      
      // Only apply size factor to costs that aren't already area-based
      const areaBasedCosts = costDetails.filter(detail => 
        Object.entries(repairCostsByType).some(([key, cost]) => 
          detail.type.toLowerCase().includes(key) && cost.unit === 'per area'
        )
      );
      
      const nonAreaBasedTotal = costDetails.reduce((sum, detail) => {
        const isAreaBased = areaBasedCosts.find(c => c.type === detail.type);
        return sum + (isAreaBased ? 0 : detail.min);
      }, 0);
      
      const areaBasedTotal = costDetails.reduce((sum, detail) => {
        const isAreaBased = areaBasedCosts.find(c => c.type === detail.type);
        return sum + (isAreaBased ? detail.min : 0);
      }, 0);
      
      // Apply area factor only to non-area-based costs
      minTotal = Math.round((nonAreaBasedTotal * areaSizeFactor) + areaBasedTotal);
      
      // Same for max costs
      const nonAreaBasedMaxTotal = costDetails.reduce((sum, detail) => {
        const isAreaBased = areaBasedCosts.find(c => c.type === detail.type);
        return sum + (isAreaBased ? 0 : detail.max);
      }, 0);
      
      const areaBasedMaxTotal = costDetails.reduce((sum, detail) => {
        const isAreaBased = areaBasedCosts.find(c => c.type === detail.type);
        return sum + (isAreaBased ? detail.max : 0);
      }, 0);
      
      maxTotal = Math.round((nonAreaBasedMaxTotal * areaSizeFactor) + areaBasedMaxTotal);
    }
    
    // Check if full replacement might be more economical
    const replacementThreshold = 0.35; // If repair costs exceed 35% of replacement, consider replacement
    let shouldConsiderReplacement = false;
    let replacementCost = { min: 0, max: 0 };
    
    if (roofArea > 0) {
      // Calculate replacement cost based on current 2025 rates
      // Average cost per sq ft for replacement ranges from $5.50 to $12.50
      replacementCost = {
        min: Math.round(roofArea * 5.5),
        max: Math.round(roofArea * 12.5)
      };
      
      // If repair cost exceeds threshold of replacement cost, suggest considering replacement
      if (minTotal > replacementCost.min * replacementThreshold) {
        shouldConsiderReplacement = true;
      }
    } else if (maxTotal > 5000) {
      // Without area measurements, use a flat threshold
      shouldConsiderReplacement = true;
    }
    
    return {
      min: minTotal,
      max: maxTotal,
      details: costDetails,
      roofArea: roofArea > 0 ? roofArea : null,
      shouldConsiderReplacement,
      replacementCost: shouldConsiderReplacement ? replacementCost : null
    };
  }, [damageData]);

  // Helper function to calculate area adjustment factor
  const calculateAreaFactor = (area) => {
    // Base the factor on average roof size (around 1,700 sq ft)
    const averageRoofSize = 1700;
    
    // Calculate factor with diminishing returns for very large roofs
    if (area <= averageRoofSize) {
      // Linear scaling for smaller roofs
      return Math.max(0.8, area / averageRoofSize);
    } else {
      // Logarithmic scaling for larger roofs to account for economies of scale
      return Math.min(2.0, 1 + (Math.log(area / averageRoofSize) / Math.log(3)));
    }
  };

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
        <h3 className="section-subtitle">Cost Estimation</h3>
        <p className="no-cost-message">No repairs needed. No cost estimate provided.</p>
      </div>
    );
  }

  return (
    <div className="cost-estimation">
      <h3 className="section-subtitle">Cost Estimation</h3>
      
      <div className="cost-range">
        <span className="cost-label">Estimated repair cost:</span>
        <span className="cost-value">{formatCurrency(costEstimate.min)} - {formatCurrency(costEstimate.max)}</span>
      </div>
      
      {costEstimate.roofArea && (
        <div className="roof-area-info">
          <span className="roof-area-label">Based on roof area:</span>
          <span className="roof-area-value">{costEstimate.roofArea.toLocaleString()} sq ft</span>
        </div>
      )}
      
      <div className="cost-disclaimer">
        <p>This is an automated estimate based on 2025 national average repair costs. Actual costs may vary based on your location, contractor rates, and the specific details of your roof.</p>
      </div>
      
      {costEstimate.details && costEstimate.details.length > 0 && (
        <div className="cost-breakdown">
          <h4>Cost Breakdown</h4>
          <div className="table-responsive">
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th className="issue-header">Issue</th>
                  <th className="range-header">Estimated Range</th>
                </tr>
              </thead>
              <tbody>
                {costEstimate.details.map((detail, index) => (
                  <tr key={index}>
                    <td className="issue-cell">{detail.type}</td>
                    <td className="range-cell">{formatCurrency(detail.min)} - {formatCurrency(detail.max)}</td>
                  </tr>
                ))}
                {costEstimate.details.length > 1 && (
                  <tr className="total-cost-row">
                    <td className="issue-cell">Total (with 15% overlap discount)</td>
                    <td className="range-cell">{formatCurrency(costEstimate.min)} - {formatCurrency(costEstimate.max)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="repair-recommendations">
        <h4>Repair Recommendations</h4>
        <p>{damageData.recommendedAction || "Contact a professional roofer for an accurate assessment and quote."}</p>
        
        {costEstimate.shouldConsiderReplacement && costEstimate.replacementCost && (
          <div className="repair-vs-replace">
            <h4>Repair vs. Replace Consideration</h4>
            <p className="replace-note">
              Based on the estimated repair costs, you may want to consider a full roof replacement instead.
              Estimated replacement cost: {formatCurrency(costEstimate.replacementCost.min)} - {formatCurrency(costEstimate.replacementCost.max)}
            </p>
            <ul className="replacement-factors">
              <li>Repairs exceed 35% of replacement cost, making replacement more cost-effective long-term</li>
              <li>Full replacement provides new warranty coverage</li>
              <li>New materials will have better energy efficiency and appearance</li>
              <li>Consider replacement especially if your roof is over 15 years old</li>
            </ul>
          </div>
        )}
        
        {!costEstimate.shouldConsiderReplacement && costEstimate.max > 3000 && (
          <div className="repair-vs-replace">
            <p className="repair-note">
              While repairs are likely more cost-effective than replacement, consider getting quotes for both options to make an informed decision.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostEstimation;
