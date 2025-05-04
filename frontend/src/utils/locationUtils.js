// src/utils/locationUtils.js
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

// Convert coordinates to address using reverse geocoding
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      throw new Error("Failed to get address from coordinates");
    }
    
    // Get the most detailed address
    const address = data.results[0];
    return {
      fullAddress: address.formatted_address,
      components: address.address_components.reduce((acc, component) => {
        component.types.forEach(type => {
          acc[type] = component.long_name;
        });
        return acc;
      }, {})
    };
  } catch (error) {
    throw new Error(`Error in reverse geocoding: ${error.message}`);
  }
};
