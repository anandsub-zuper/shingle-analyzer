// src/utils/responseUtils.js

/**
 * Utility functions for processing OpenAI API responses
 */

/**
 * Extract structured data from OpenAI API response
 * @param {Object} apiResponse - Raw API response from OpenAI
 * @returns {Object} Parsed structured data 
 */
export const extractStructuredData = (apiResponse) => {
  if (!apiResponse || !apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message) {
    return null;
  }

  try {
    // If backend already parsed the JSON
    if (apiResponse.parsedResults) {
      return apiResponse.parsedResults;
    }

    // Try to extract JSON from the content string
    const content = apiResponse.choices[0].message.content;
    
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

export default {
  extractStructuredData
};
