// src/utils/jsonUtils.js

/**
 * Utility functions for handling JSON responses from the OpenAI API
 */

/**
 * Extracts and parses JSON from OpenAI API response text
 * @param {string} content - Raw content string from API response
 * @returns {Object|null} Parsed JSON object or null if parsing fails
 */
export const extractJsonFromContent = (content) => {
  if (!content || typeof content !== 'string') {
    console.error("Invalid content provided for JSON extraction");
    return null;
  }
  
  // Try to extract JSON from code blocks
  if (content.includes('```json')) {
    const matches = content.match(/```json\s*([\s\S]*?)(\s*```|$)/);
    if (matches && matches[1]) {
      try {
        return JSON.parse(matches[1]);
      } catch (e) {
        console.error("Failed to parse JSON from code block", e);
      }
    }
  }
  
  // Try to extract JSON directly from content
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse direct JSON from content", e);
  }
  
  // Try a more flexible approach to find valid JSON
  return extractLargestJsonObject(content);
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
 * Normalizes API response structure to ensure consistent access patterns
 * regardless of the actual field names in the response
 * @param {Object} data - Raw parsed data object
 * @returns {Object} Normalized data structure
 */
export const normalizeApiResponse = (data) => {
  if (!data) return null;
  
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
  
  return fixedJson;
};

export default {
  extractJsonFromContent,
  extractLargestJsonObject,
  normalizeApiResponse,
  safeGet,
  attemptJsonRepair
};
