// src/utils/locationUtils.js

/**
 * Detect the user's location using browser geolocation API
 * @returns {Promise} - Resolves with coordinates {latitude, longitude}
 */
export const detectUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ latitude, longitude });
      },
      (error) => {
        reject(new Error(`Error getting location: ${error.message}`));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

/**
 * Convert coordinates to address using reverse geocoding
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise} - Resolves with address information
 */
export const getAddressFromCoordinates = async (latitude, longitude) => {
  // If Google Maps API key is not available, return a simulated response
  if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    console.log('No Google Maps API key provided - using simulated address data');
    // Return simulated address data for development purposes
    return simulateAddressData();
  }
  
  try {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      throw new Error("Failed to get address from coordinates");
    }
    
    // Get the most detailed address
    const address = data.results[0];
    
    // Extract address components
    const addressComponents = {};
    address.address_components.forEach(component => {
      component.types.forEach(type => {
        addressComponents[type] = component.long_name;
      });
    });
    
    return {
      fullAddress: address.formatted_address,
      components: addressComponents
    };
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    // Fall back to simulated data on error
    return simulateAddressData();
  }
};

/**
 * Generate simulated address data for development or when API is unavailable
 * @returns {Object} - Simulated address information
 */
const simulateAddressData = () => {
  return {
    fullAddress: "123 Main St, Seattle, WA 98101, USA",
    components: {
      street_number: "123",
      route: "Main St",
      locality: "Seattle",
      administrative_area_level_1: "WA",
      postal_code: "98101",
      country: "USA"
    }
  };
};
