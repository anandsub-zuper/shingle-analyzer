// src/utils/propertyUtils.js

/**
 * Fetch property information from the RentCast API
 * @param {string} address - Property address
 * @param {string} apiKey - RentCast API key
 * @returns {Promise<Object>} - Property information
 */
export const fetchPropertyInfo = async (address, apiKey) => {
  try {
    // If no API key is provided or we're in development without a key,
    // return simulated property data
    if (!apiKey || process.env.NODE_ENV === 'development' && !process.env.REACT_APP_RENTCAST_API_KEY) {
      console.log('No RentCast API key provided - using simulated property data');
      return simulatePropertyData(address);
    }
    
    // Format address for API
    const formattedAddress = encodeURIComponent(address);
    
    // Make API request
    const response = await fetch(
      `https://api.rentcast.io/v1/properties?address=${formattedAddress}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Check for successful response
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    // Parse response data
    const data = await response.json();
    
    // Extract and format useful property information
    return {
      propertyId: data.id,
      address: {
        street: data.address?.line1,
        city: data.address?.city,
        state: data.address?.state,
        zipCode: data.address?.zipCode,
        fullAddress: data.address?.full
      },
      details: {
        propertyType: data.propertyType,
        yearBuilt: data.yearBuilt,
        squareFootage: data.squareFootage,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        lotSize: data.lotSize
      },
      valuation: {
        estimatedValue: data.estimatedValue,
        lastSalePrice: data.lastSalePrice,
        lastSaleDate: data.lastSaleDate
      },
      parcelInfo: {
        parcelId: data.parcelId,
        taxAssessedValue: data.taxAssessedValue,
        taxYear: data.taxYear
      }
    };
  } catch (error) {
    console.error("Error fetching property information:", error);
    // Fall back to simulated data on error
    return simulatePropertyData(address);
  }
};

/**
 * Generate simulated property data for development or when API is unavailable
 * @param {string} address - Property address to use in the simulated data
 * @returns {Object} - Simulated property information
 */
const simulatePropertyData = (address) => {
  return {
    propertyId: "sim-123456",
    address: {
      street: address.split(',')[0] || "123 Main St",
      city: address.includes(',') ? address.split(',')[1].trim() : "Seattle",
      state: "WA",
      zipCode: "98101",
      fullAddress: address || "123 Main St, Seattle, WA 98101"
    },
    details: {
      propertyType: "SingleFamily",
      yearBuilt: 1985,
      squareFootage: 2200,
      bedrooms: 3,
      bathrooms: 2.5,
      lotSize: 5500
    },
    valuation: {
      estimatedValue: 750000,
      lastSalePrice: 680000,
      lastSaleDate: "2018-06-15"
    },
    parcelInfo: {
      parcelId: "1234567890",
      taxAssessedValue: 720000,
      taxYear: 2023
    }
  };
};
