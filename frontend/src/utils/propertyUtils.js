// src/utils/propertyUtils.js
export const fetchPropertyInfo = async (address, apiKey) => {
  try {
    // Format address for API
    const formattedAddress = encodeURIComponent(address);
    
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
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract useful property information
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
    throw error;
  }
};
