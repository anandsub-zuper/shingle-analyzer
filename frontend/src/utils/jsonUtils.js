// src/utils/jsonUtils.js

/**
 * Utility functions for handling JSON responses from the OpenAI API
 */

/**
 * Extracts and parses JSON from OpenAI API response text with enhanced reliability
 * @param {string} content - Raw content string from API response
 * @returns {Object|null} Parsed JSON object or null if parsing fails
 */
export const extractJsonFromContent = (content) => {
  if (!content || typeof content !== 'string') {
    console.error("Invalid content provided for JSON extraction");
    return null;
  }
  
  let result = null;
  
  // Method 1: Extract JSON from code blocks (most reliable if present)
  if (content.includes('```json')) {
    try {
      const matches = content.match(/```json\s*([\s\S]*?)(\s*```|$)/);
      if (matches && matches[1]) {
        const cleanJson = matches[1].trim();
        result = JSON.parse(cleanJson);
        console.log("Successfully extracted JSON from code block");
        return result;
      }
    } catch (e) {
      console.warn("Failed to parse JSON from code block:", e.message);
    }
  }
  
  // Method 2: Extract JSON directly from content
  try {
    const jsonMatch = content.match(/(\{[\s\S]*\})/);
    if (jsonMatch && jsonMatch[1]) {
      const cleanJson = jsonMatch[1].trim();
      result = JSON.parse(cleanJson);
      console.log("Successfully extracted direct JSON from content");
      return result;
    }
  } catch (e) {
    console.warn("Failed to parse direct JSON from content:", e.message);
  }
  
  // Method 3: Try to extract largest valid JSON object
  result = extractLargestJsonObject(content);
  if (result) {
    console.log("Successfully extracted largest JSON object");
    return result;
  }
  
  // Method 4: Aggressive approach - try to find and repair any JSON-like structure
  result = extractJsonAggressively(content);
  if (result) {
    console.log("Successfully extracted JSON using aggressive approach");
    return result;
  }
  
  console.error("All JSON extraction methods failed");
  return null;
};

/**
 * Attempts to find and extract the largest valid JSON object in a string
 * @param {string} text - Text that might contain JSON objects
 * @returns {Object|null} Largest valid JSON object or null if none found
 */
export const extractLargestJsonObject = (text) => {
  if (!text || typeof text !== 'string') return null;
  
  let maxOpenBraces = 0;
  let currentOpenBraces = 0;
  let potentialStart = -1;
  let bestObject = null;
  let bestObjectSize = 0;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (currentOpenBraces === 0) {
        potentialStart = i;
      }
      currentOpenBraces++;
      maxOpenBraces = Math.max(maxOpenBraces, currentOpenBraces);
    } else if (text[i] === '}') {
      if (currentOpenBraces > 0) {
        currentOpenBraces--;
        if (currentOpenBraces === 0 && potentialStart !== -1) {
          // We found a complete object, try to parse it
          try {
            const jsonStr = text.substring(potentialStart, i + 1);
            const obj = JSON.parse(jsonStr);
            const objSize = JSON.stringify(obj).length;
            
            // Keep track of the largest valid object
            if (objSize > bestObjectSize) {
              bestObject = obj;
              bestObjectSize = objSize;
            }
          } catch (e) {
            // Not valid JSON, continue searching
          }
        }
      }
    }
  }
  
  return bestObject;
};

/**
 * Aggressively tries to extract any JSON-like structure, repairing if necessary
 * @param {string} text - Text that might contain JSON structures
 * @returns {Object|null} Parsed object or null if extraction fails
 */
export const extractJsonAggressively = (text) => {
  if (!text || typeof text !== 'string') return null;
  
  // Look for any text between curly braces (potentially JSON objects)
  const allJsonMatches = text.match(/\{[\s\S]*?\}/g) || [];
  
  // Sort potential JSON objects by size (largest first)
  allJsonMatches.sort((a, b) => b.length - a.length);
  
  // Try each match until we find valid JSON
  for (const jsonCandidate of allJsonMatches) {
    try {
      const repaired = attemptJsonRepair(jsonCandidate);
      const parsed = JSON.parse(repaired);
      
      // Check if it has any of our expected fields or sufficient size
      if (parsed.MATERIAL_SPECIFICATION || 
          parsed.materialSpecification ||
          parsed.DAMAGE_ASSESSMENT ||
          parsed.damageAssessment ||
          Object.keys(parsed).length > 3) {
        return parsed;
      }
    } catch (e) {
      // Continue to next candidate
    }
  }
  
  return null;
};

/**
 * Normalizes API response structure with enhanced robustness
 * @param {Object} data - Raw parsed data object
 * @returns {Object} Normalized data structure
 */
export const normalizeApiResponse = (data) => {
  if (!data) return null;
  
  // Log the structure we're working with
  console.log("Normalizing data structure:", Object.keys(data));
  
  // Check for all possible section names (case variations, etc.)
  const materialSection = 
    data["MATERIAL_SPECIFICATION"] || 
    data["MATERIAL SPECIFICATION"] || 
    data["materialSpecification"] || 
    data["material_specification"] || 
    {};
    
  const damageSection = 
    data["DAMAGE_ASSESSMENT"] || 
    data["DAMAGE ASSESSMENT"] || 
    data["damageAssessment"] || 
    data["damage_assessment"] || 
    {};
    
  const repairSection = 
    data["REPAIR_ASSESSMENT"] || 
    data["REPAIR ASSESSMENT"] || 
    data["repairAssessment"] || 
    data["repair_assessment"] || 
    {};
    
  const metadataSection = 
    data["METADATA"] || 
    data["metadata"] || 
    {};
  
  // Create a standardized structure
  const normalized = {
    materialSpecification: materialSection,
    damageAssessment: damageSection,
    repairAssessment: repairSection,
    metadata: metadataSection
  };
  
  // Check if we have any meaningful data in the main sections
  const hasData = Object.keys(normalized.materialSpecification).length > 0 || 
                 Object.keys(normalized.damageAssessment).length > 0;
  
  if (!hasData) {
    console.warn("No data found in standard sections, searching deeply within structure");
    
    // Try to extract data from non-standard structure
    // This handles cases where the JSON structure differs from expected
    
    // Deep search for material properties
    const findDeep = (obj, targetKeys) => {
      const results = {};
      
      const search = (object, path = []) => {
        if (!object || typeof object !== 'object') return;
        
        for (const key in object) {
          if (targetKeys.includes(key.toLowerCase())) {
            results[key] = object[key];
          } else if (typeof object[key] === 'object') {
            search(object[key], [...path, key]);
          }
        }
      };
      
      search(obj);
      return results;
    };
    
    // Look for common material properties
    const materialKeys = ['name', 'manufacturer', 'material', 'type', 'shingle'];
    const materialProps = findDeep(data, materialKeys);
    
    // Look for damage properties
    const damageKeys = ['damage', 'condition', 'issues', 'severity'];
    const damageProps = findDeep(data, damageKeys);
    
    // Apply any found properties
    for (const [key, value] of Object.entries(materialProps)) {
      normalized.materialSpecification[key] = value;
    }
    
    for (const [key, value] of Object.entries(damageProps)) {
      normalized.damageAssessment[key] = value;
    }
    
    console.log("After deep search, found material properties:", 
                Object.keys(normalized.materialSpecification).length);
    console.log("After deep search, found damage properties:", 
                Object.keys(normalized.damageAssessment).length);
  }
  
  return normalized;
};

/**
 * Attempts to salvage broken JSON by fixing common JSON syntax errors
 * @param {string} jsonString - Potentially malformed JSON string
 * @returns {string} Fixed JSON string or original if no fixes applied
 */
export const attemptJsonRepair = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') return jsonString;
  
  let fixedJson = jsonString;
  
  // Fix missing quotes around property names
  fixedJson = fixedJson.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  
  // Fix single quotes used instead of double quotes
  fixedJson = fixedJson.replace(/'/g, '"');
  
  // Fix trailing commas in objects and arrays
  fixedJson = fixedJson.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
  
  // Fix extra commas
  fixedJson = fixedJson.replace(/,\s*,/g, ',');
  
  // Fix missing closing brackets (simplified approach)
  const openBraces = (fixedJson.match(/\{/g) || []).length;
  const closeBraces = (fixedJson.match(/\}/g) || []).length;
  
  if (openBraces > closeBraces) {
    fixedJson += '}';
  }
  
  return fixedJson;
};

/**
 * Safe getter function for accessing potentially undefined nested properties
 * @param {Object} obj - Object to get property from
 * @param {string} path - Dot notation path to property
 * @param {*} defaultValue - Default value if property doesn't exist
 * @returns {*} Property value or default value
 */
export const safeGet = (obj, path, defaultValue = "Unknown") => {
  if (!obj || !path) return defaultValue;
  
  try {
    const result = path.split('.').reduce((o, p) => o?.[p], obj);
    return result !== undefined && result !== null ? result : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export default {
  extractJsonFromContent,
  extractLargestJsonObject,
  extractJsonAggressively,
  normalizeApiResponse,
  safeGet,
  attemptJsonRepair
};
