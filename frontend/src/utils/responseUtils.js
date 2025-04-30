// src/utils/responseUtils.js

/**
 * Utility functions for processing enhanced API responses
 */

/**
 * Extract structured data from OpenAI API response
 * @param {Object} response - Raw API response from OpenAI
 * @returns {Object} Parsed structured data or null if parsing fails
 */
export const extractStructuredData = (response) => {
  if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
    return null;
  }

  try {
    // If backend already parsed the JSON
    if (response.parsedResults) {
      return response.parsedResults;
    }

    // Try to extract JSON from the content string
    const content = response.choices[0].message.content;
    
    // Look for JSON pattern in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Try parsing the whole content as JSON
    try {
      return JSON.parse(content);
    } catch (e) {
      console.warn("Could not parse content as JSON", e);
      return null;
    }
  } catch (error) {
    console.error("Error extracting structured data:", error);
    return null;
  }
};

/**
 * Calculate total damage percentage based on individual damage types
 * @param {Object} damageAssessment - Damage assessment data
 * @returns {number} Total damage percentage
 */
export const calculateTotalDamagePercentage = (damageAssessment) => {
  if (!damageAssessment) return 0;
  
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
  
  // Calculate total affected area with overlap adjustment
  let totalAffectedPercentage = 0;
  let overlapAdjustment = 0;
  
  damageTypes.forEach(type => {
    const damage = damageAssessment[type];
    if (damage && damage.present && damage.coverage) {
      totalAffectedPercentage += damage.coverage;
      // Apply 15% overlap adjustment for each additional damage type
      if (totalAffectedPercentage > 0) {
        overlapAdjustment += damage.coverage * 0.15;
      }
    }
  });
  
  // Adjust for overlap (assuming some damage types affect the same areas)
  const adjustedPercentage = Math.min(100, totalAffectedPercentage - overlapAdjustment);
  
  return Math.round(adjustedPercentage);
};

/**
 * Calculate remaining roof life based on material specifications and damage
 * @param {Object} materialSpec - Material specifications
 * @param {Object} damageAssessment - Damage assessment data
 * @returns {Object} Remaining life estimates
 */
export const calculateRemainingLife = (materialSpec, damageAssessment) => {
  if (!materialSpec || !damageAssessment) {
    return { years: 'Unknown', percentage: 0 };
  }
  
  // Extract expected lifespan
  let expectedLifespan = 0;
  if (materialSpec.lifespan) {
    // Parse lifespan string to extract years
    const lifespanMatch = materialSpec.lifespan.match(/(\d+)/);
    if (lifespanMatch) {
      expectedLifespan = parseInt(lifespanMatch[1], 10);
    }
  }
  
  // If no valid lifespan, use defaults based on material type
  if (!expectedLifespan) {
    switch (materialSpec.material?.toLowerCase()) {
      case 'asphalt':
        expectedLifespan = materialSpec.materialSubtype?.toLowerCase().includes('architectural') ? 30 : 20;
        break;
      case 'metal':
        expectedLifespan = 50;
        break;
      case 'wood':
        expectedLifespan = 25;
        break;
      case 'clay':
      case 'slate':
        expectedLifespan = 75;
        break;
      default:
        expectedLifespan = 25;
    }
  }
  
  // Extract estimated age
  let estimatedAge = 0;
  if (materialSpec.estimatedAge) {
    // If range like "5-7 years", take average
    if (materialSpec.estimatedAge.includes('-')) {
      const ranges = materialSpec.estimatedAge.match(/(\d+)-(\d+)/);
      if (ranges && ranges.length >= 3) {
        estimatedAge = (parseInt(ranges[1], 10) + parseInt(ranges[2], 10)) / 2;
      }
    } else {
      // Extract single number
      const ageMatch = materialSpec.estimatedAge.match(/(\d+)/);
      if (ageMatch) {
        estimatedAge = parseInt(ageMatch[1], 10);
      }
    }
  }
  
  // Calculate base remaining life
  let baseRemainingYears = Math.max(0, expectedLifespan - estimatedAge);
  
  // Apply damage severity adjustment
  const damageSeverity = damageAssessment.damageSeverity || 0;
  let severityMultiplier = 1;
  
  if (damageSeverity >= 8) {
    // Critical damage - significantly reduces remaining life
    severityMultiplier = 0.3;  // 70% reduction
  } else if (damageSeverity >= 6) {
    // Severe damage
    severityMultiplier = 0.6;  // 40% reduction
  } else if (damageSeverity >= 4) {
    // Moderate damage
    severityMultiplier = 0.8;  // 20% reduction
  } else if (damageSeverity >= 2) {
    // Minor damage
    severityMultiplier = 0.9;  // 10% reduction
  }
  
  // Calculate adjusted remaining years
  const adjustedRemainingYears = Math.round(baseRemainingYears * severityMultiplier);
  
  // Calculate percentage of life remaining
  const percentageRemaining = Math.round((adjustedRemainingYears / expectedLifespan) * 100);
  
  return {
    years: adjustedRemainingYears > 0 ? `${adjustedRemainingYears} years` : 'Less than 1 year',
    percentage: Math.min(100, Math.max(0, percentageRemaining))
  };
};

/**
 * Generate repair priority level based on damage assessment
 * @param {Object} damageAssessment - Damage assessment data
 * @returns {string} Priority level description
 */
export const getRepairPriority = (damageAssessment) => {
  if (!damageAssessment) return 'Unknown';
  
  const severity = damageAssessment.damageSeverity || 0;
  const structuralConcerns = damageAssessment.structuralConcerns || false;
  const progressiveIssues = damageAssessment.progressiveIssues || false;
  const waterDamage = damageAssessment.waterDamage?.present || false;
  
  // Immediate priority if structural concerns exist
  if (structuralConcerns) {
    return 'Immediate - Structural concerns present';
  }
  
  // High priority if water damage and progressive issues
  if (waterDamage && progressiveIssues) {
    return 'High - Water damage with progressive deterioration';
  }
  
  // Priority based on severity
  if (severity >= 8) {
    return 'Urgent - Severe damage requiring prompt attention';
  } else if (severity >= 6) {
    return 'High - Significant damage requiring timely repairs';
  } else if (severity >= 4) {
    return 'Moderate - Address within 3-6 months';
  } else if (severity >= 2) {
    return 'Low - Monitor and address during routine maintenance';
  } else {
    return 'None - No significant issues detected';
  }
};

/**
 * Generate cost estimation range based on damage assessment and material
 * @param {Object} damageAssessment - Damage assessment data
 * @param {Object} materialSpec - Material specifications
 * @returns {Object} Cost estimation ranges
 */
export const estimateRepairCosts = (damageAssessment, materialSpec) => {
  if (!damageAssessment) {
    return { repair: 'Unknown', replacement: 'Unknown' };
  }
  
  // Base cost factors per square (100 sq ft)
  const baseCostPerSquare = {
    asphalt: { min: 350, max: 550 },
    metal: { min: 800, max: 1200 },
    wood: { min: 650, max: 950 },
    clay: { min: 1000, max: 2000 },
    slate: { min: 1500, max: 2500 },
    concrete: { min: 850, max: 1250 },
    default: { min: 500, max: 850 }
  };
  
  // Determine material type
  const materialType = materialSpec?.material?.toLowerCase() || 'default';
  const costFactor = baseCostPerSquare[materialType] || baseCostPerSquare.default;
  
  // Calculate damage percentage
  const damagePercentage = calculateTotalDamagePercentage(damageAssessment);
  
  // Base total roof area (estimate if not provided)
  const totalRoofArea = damageAssessment.roofArea || 1800; // Default to average roof size
  const totalSquares = totalRoofArea / 100;
  
  // Calculate affected squares
  const affectedSquares = totalSquares * (damagePercentage / 100);
  
  // Calculate repair costs
  const minRepairCost = Math.round(affectedSquares * costFactor.min);
  const maxRepairCost = Math.round(affectedSquares * costFactor.max);
  
  // Calculate replacement costs
  const minReplacementCost = Math.round(totalSquares * costFactor.min);
  const maxReplacementCost = Math.round(totalSquares * costFactor.max);
  
  // Add labor and overhead
  const minRepairWithLabor = Math.round(minRepairCost * 1.4); // 40% labor/overhead
  const maxRepairWithLabor = Math.round(maxRepairCost * 1.5); // 50% labor/overhead
  
  const minReplacementWithLabor = Math.round(minReplacementCost * 1.5); // 50% labor/overhead
  const maxReplacementWithLabor = Math.round(maxReplacementCost * 1.6); // 60% labor/overhead
  
  // Format as currency strings
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  return {
    repair: `${formatCurrency(minRepairWithLabor)} - ${formatCurrency(maxRepairWithLabor)}`,
    replacement: `${formatCurrency(minReplacementWithLabor)} - ${formatCurrency(maxReplacementWithLabor)}`
  };
};

/**
 * Determine if a roof should be repaired or replaced
 * @param {Object} damageAssessment - Damage assessment data
 * @param {Object} materialSpec - Material specifications 
 * @returns {Object} Recommendation with reasoning
 */
export const getRepairOrReplaceRecommendation = (damageAssessment, materialSpec) => {
  if (!damageAssessment || !materialSpec) {
    return { recommendation: 'Unknown', reasoning: 'Insufficient data' };
  }
  
  const severity = damageAssessment.damageSeverity || 0;
  const damagePercentage = calculateTotalDamagePercentage(damageAssessment);
  const remainingLife = calculateRemainingLife(materialSpec, damageAssessment);
  
  // Factors favoring replacement
  const factorsForReplacement = [];
  
  // Check damage percentage
  if (damagePercentage > 35) {
    factorsForReplacement.push('Extensive damage coverage (over 35% of roof affected)');
  }
  
  // Check severity
  if (severity >= 7) {
    factorsForReplacement.push('High damage severity (7+ out of 10)');
  }
  
  // Check age relative to expected lifespan
  if (remainingLife.percentage < 25) {
    factorsForReplacement.push('Limited remaining lifespan (less than 25% of expected life)');
  }
  
  // Check for serious issues
  if (damageAssessment.structuralConcerns) {
    factorsForReplacement.push('Structural concerns present');
  }
  
  if (damageAssessment.waterDamage && damageAssessment.waterDamage.present && 
      damageAssessment.waterDamage.severity > 5) {
    factorsForReplacement.push('Significant water damage present');
  }
  
  // Generate recommendation
  let recommendation;
  let reasoning;
  
  if (factorsForReplacement.length >= 2) {
    recommendation = 'Replace';
    reasoning = `Replacement recommended based on: ${factorsForReplacement.join(', ')}`;
  } else if (factorsForReplacement.length === 1) {
    recommendation = 'Consider Replacement';
    reasoning = `Consider replacement due to: ${factorsForReplacement[0]}. Get multiple professional opinions.`;
  } else if (severity > 3 || damagePercentage > 10) {
    recommendation = 'Repair';
    reasoning = `Repairs recommended. Damage is significant enough to address but not severe enough to warrant full replacement.`;
  } else {
    recommendation = 'Monitor';
    reasoning = `Minor damage detected. Monitor the condition and address any changes during routine maintenance.`;
  }
  
  return { recommendation, reasoning };
};

export default {
  extractStructuredData,
  calculateTotalDamagePercentage,
  calculateRemainingLife,
  getRepairPriority,
  estimateRepairCosts,
  getRepairOrReplaceRecommendation
};
