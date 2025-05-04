import React, { useState, useEffect, useCallback } from 'react';

const HomeLocationDetector = ({ onLocationDetected }) => {
  const [status, setStatus] = useState('idle');
  const [coordinates, setCoordinates] = useState(null);
  const [address, setAddress] = useState(null);
  const [userEditedAddress, setUserEditedAddress] = useState('');
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [propertyData, setPropertyData] = useState(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertyError, setPropertyError] = useState(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

    // Helper function to format coordinates
    const formatCoordinate = (value) => {
        return value ? value.toFixed(6) : '0.000000';
    };

  // Helper function to get property type with fallback
  const getPropertyType = () => {
    if (propertyData?.propertyType) {
      return propertyData.propertyType;
    }
    return "Property"; // Default to "Unknown Type" or "Property"
  };

  const getLastSaleDate = () => {
    if (propertyData?.lastSaleDate) {
      try {
        const date = new Date(propertyData.lastSaleDate);
        return date.toLocaleDateString();  // Format the date
      } catch (e) {
        console.error("Error parsing lastSaleDate", e);
        return "Invalid Date";
      }
    }
    return "N/A";
  };

  // Function to handle map viewing with improved accuracy
  const viewOnMap = () => {
    if (coordinates) {
      // Use a more precise zoom level (e.g., 18 or higher)
      const zoom = 18;
      const mapUrl = `https://www.google.com/maps/@${coordinates.latitude},${coordinates.longitude},${zoom}z`;
      window.open(mapUrl, '_blank');
    }
  };

  const detectLocation = async () => {
    try {
      setStatus('detecting');
      setError(null);

      // Step 1: Get coordinates from browser using the Geolocation API
      const coords = await getCurrentLocation();
      setCoordinates(coords);

      // Step 2: Convert coordinates to address
      const addressData = await getAddressFromCoordinates(coords.latitude, coords.longitude);
      setAddress(addressData);
      setUserEditedAddress(''); // Reset edited address

      // Call the callback with all the location data
      if (onLocationDetected) {
        onLocationDetected({
          coordinates: coords,
          address: addressData,
        });
      }

      setStatus('success');
      setExpanded(true);
    } catch (err) {
      console.error('Error detecting location:', err);
      setError(err.message || 'Failed to detect location');
      setStatus('error');
    }
  };

  // Get the user's current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      // Create a timeout for the geolocation request
      const timeoutId = setTimeout(() => {
        reject(new Error("Location request timed out. Please try again."));
      }, 15000); // 15 seconds timeout

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Clear the timeout since we got a successful response
          clearTimeout(timeoutId);

          const { latitude, longitude, accuracy } = position.coords;
          resolve({
            latitude,
            longitude,
            accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          // Clear the timeout since we got an error response
          clearTimeout(timeoutId);

          // Provide user-friendly error messages
          let errorMessage;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location access was denied. Please allow location access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage =
                "Location information is unavailable. Please try again later.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out. Please try again.";
              break;
            default:
              errorMessage = `Error getting location: ${error.message}`;
          }

          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    });
  };

  // Convert coordinates to address using Nominatim (OpenStreetMap)
  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      // Generate a cache-busting timestamp to prevent caching issues
      const timestamp = new Date().getTime();

      // Use OpenStreetMap's Nominatim service for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&_=${timestamp}`,
        {
          headers: {
            // Nominatim requires a User-Agent header
            'User-Agent': 'RoofAnalyzerApp/1.0',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.address) {
        throw new Error("No address data returned");
      }

      // Map Nominatim address components to our expected format
      const components = {
        street_number: data.address.house_number,
        route: data.address.road,
        locality: data.address.city || data.address.town || data.address.village,
        administrative_area_level_1: data.address.state,
        postal_code: data.address.postcode,
        country: data.address.country,
      };

      return {
        fullAddress: data.display_name,
        components: components,
      };
    } catch (error) {
      console.warn('Error getting address:', error);

      // Fallback to coordinates as address if geocoding fails
      return {
        fullAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        components: {},
      };
    }
  };


  // Fetch property data from RentCast API
  const fetchPropertyData = async (addressStr) => {
    if (!addressStr) return;

    setPropertyLoading(true);
    setPropertyError(null);

    try {
      // Replace with your actual API key
      const apiKey = process.env.REACT_APP_RENTCAST_API_KEY;
      if (!apiKey) {
        console.warn(
          "RentCast API key is missing. Please set the REACT_APP_RENTCAST_API_KEY environment variable.",
        );
        setPropertyError("API key is missing.  Property data cannot be loaded."); //Set Error message
        setPropertyLoading(false);
        return;
      }

      // Encode the address for URL
      const encodedAddress = encodeURIComponent(addressStr);
       const url = `https://api.rentcast.io/v1/properties?address=${encodedAddress}`;
      console.log("Fetching property data from:", url); // Log the URL

      // Make the API request
      const response = await fetch(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Api-Key': apiKey,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text(); // Get the error message from the response
        console.error('RentCast API error:', response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Save the property data
      setPropertyData(data[0]); // Access the first element of the array
      console.log('Property data:', data[0]);

      // Also fetch rent estimate if property data was found
      if (data[0] && data[0].id) {
        fetchRentEstimate(data[0].id, apiKey);
      }
    } catch (error) {
      console.error('Error fetching property data:', error);
      setPropertyError(error.message);
    } finally {
      setPropertyLoading(false);
    }
  };

  // Fetch rent estimate from RentCast API
  const fetchRentEstimate = async (propertyId, apiKey) => {
    if (!propertyId) return;

    try {
      if (!apiKey) {
        console.warn(
          "RentCast API key is missing. Please set the REACT_APP_RENTCAST_API_KEY environment variable.",
        );
        return; // Don't throw error,  just log to console.
      }
      const url = `https://api.rentcast.io/v1/avm/rent/long-term?propertyId=${propertyId}`;
      console.log("Fetching rent estimate from:", url);
      // Make the API request
      const response = await fetch(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Api-Key': apiKey,
          },
        },
      );

      if (!response.ok) {
         const errorText = await response.text();
         console.error('RentCast API error:', response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Add rent estimate to property data
      setPropertyData((prevData) => ({
        ...prevData,
        rentEstimate: data,
      }));
    } catch (error) {
      console.error('Error fetching rent estimate:', error);
      // Not setting error state here as it's a non-critical enhancement
    }
  };

  const handleAddressChange = (event) => {
    setUserEditedAddress(event.target.value);
  };

  // useCallback is crucial here to prevent infinite loop
  const handleAddressUpdate = useCallback(() => {
    if (userEditedAddress) {
      fetchPropertyData(userEditedAddress);
    }
  }, [userEditedAddress]);

  const displayAddress = () => {
    return userEditedAddress || address?.fullAddress || `${formatCoordinate(coordinates?.latitude)}, ${formatCoordinate(coordinates?.longitude)}`;
  };

  useEffect(() => {
    if (status === 'success') {
      setUserEditedAddress(address?.fullAddress || '');
    }
  }, [status, address]);

  const displayedFeatures =
    propertyData?.features &&
    Object.entries(propertyData.features).filter(
      ([_, value]) => value !== null && value !== "",
    );

  const featuresToShow = showAllFeatures
    ? displayedFeatures
    : displayedFeatures?.slice(0, 6);
  const hasMoreFeatures = displayedFeatures?.length > 6;



  return (
    <div className="home-location-section">
      <div className="location-header" onClick={() => setExpanded(!expanded)}>
        <h3>
          <span className="location-icon">📍</span> Home Location
          <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>▼</span>
        </h3>

        {status === 'success' && !expanded && (
          <div className="location-preview">
            {displayAddress()}
          </div>
        )}
      </div>

      {expanded && (
        <div className="location-content">
          {status === 'idle' && (
            <div className="location-prompt">
              <p>
                Detecting your home location can help provide more accurate roof
                analysis results.
              </p>
              <button
                onClick={detectLocation}
                className="detect-button"
                disabled={status === 'detecting'}
              >
                {status === 'detecting' ? (
                  <>
                    <span className="spinner"></span>
                    Detecting Your Location...
                  </>
                ) : (
                  <>Detect My Location</>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span> {error}
              <button onClick={detectLocation} className="retry-button">
                Try Again
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="location-details">
              <div className="location-data">
                <div className="data-section">
                  <h4>Coordinates</h4>
                  <div className="coordinate-grid">
                    <div className="coordinate-item">
                      <span className="coordinate-label">Latitude</span>
                      <span className="coordinate-value">
                        {formatCoordinate(coordinates?.latitude)}
                      </span>
                    </div>
                    <div className="coordinate-item">
                      <span className="coordinate-label">Longitude</span>
                      <span className="coordinate-value">
                        {formatCoordinate(coordinates?.longitude)}
                      </span>
                    </div>
                  </div>
                </div>

                {address && (
                  <div className="data-section">
                    <h4>Address</h4>
                    <div className="address-display">
                      <div className="address-input-container">
                        <input
                          type="text"
                          value={displayAddress()}
                          onChange={handleAddressChange}
                          placeholder="Enter address"
                          className="address-input"
                        />
                        <button
                          onClick={handleAddressUpdate}
                          className="update-button"
                        >
                          Update
                        </button>
                      </div>
                      <p className="address-disclaimer">
                        <small>
                          The displayed address may not be exact. Please use the map
                          below to verify.
                        </small>
                      </p>
                      {address.components && (
                        <div className="address-components">
                          {address.components.locality && (
                            <div className="address-component">
                              <span className="component-label">City</span>
                              <span className="component-value">
                                {address.components.locality}
                              </span>
                            </div>
                          )}
                          {address.components.administrative_area_level_1 && (
                            <div className="address-component">
                              <span className="component-label">State</span>
                              <span className="component-value">
                                {address.components.administrative_area_level_1}
                              </span>
                            </div>
                          )}
                          {address.components.postal_code && (
                            <div className="address-component">
                              <span className="component-label">ZIP</span>
                              <span className="component-value">
                                {address.components.postal_code}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Property Data Section */}
              {propertyLoading && (
                <div className="data-section">
                  <h4>Property Data</h4>
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>Loading property data...</span>
                  </div>
                </div>
              )}

              {propertyError && (
                <div className="data-section">
                  <h4>Property Data</h4>
                  <div className="property-error">
                    <p>Error loading property data: {propertyError}</p>
                  </div>
                </div>
              )}

              {propertyData && !propertyLoading && !propertyError && (
                <div className="data-section property-section">
                  <h4>Property Information</h4>
                  <div className="property-info-container">
                    <div className="property-overview">
                      <div className="property-type-badge">
                        {getPropertyType()}
                      </div>

                      {propertyData.yearBuilt && (
                        <div className="property-year">
                          Built in {propertyData.yearBuilt}
                        </div>
                      )}
                    </div>

                    <div className="property-specs-grid">
                      {propertyData.bedrooms && (
                        <div className="property-spec">
                          <span className="spec-icon">🛏️</span>
                          <span className="spec-value">
                            {propertyData.bedrooms}
                          </span>
                          <span className="spec-label">Beds</span>
                        </div>
                      )}

                      {propertyData.bathrooms && (
                        <div className="property-spec">
                          <span className="spec-icon">🚿</span>
                          <span className="spec-value">
                            {propertyData.bathrooms}
                          </span>
                          <span className="spec-label">Baths</span>
                        </div>
                      )}

                      {propertyData.squareFootage && (
                        <div className="property-spec">
                          <span className="spec-icon">📏</span>
                          <span className="spec-value">
                            {propertyData.squareFootage?.toLocaleString()}
                          </span>
                          <span className="spec-label">Sq Ft</span>
                        </div>
                      )}

                      {propertyData.lotSize && (
                        <div className="property-spec">
                          <span className="spec-icon">🌳</span>
                          <span className="spec-value">
                            {propertyData.lotSize?.toLocaleString()}
                          </span>
                          <span className="spec-label">Lot Sq Ft</span>
                        </div>
                      )}
                    </div>

                    {propertyData.rentEstimate && (
                      <div className="property-valuation">
                        <div className="valuation-item">
                          <span className="valuation-label">
                            Estimated Rent
                          </span>
                          <span className="valuation-value">
                            $
                            {propertyData.rentEstimate.rent?.toLocaleString()}/mo
                          </span>
                        </div>

                        {propertyData.lastSalePrice && (
                          <div className="valuation-item">
                            <span className="valuation-label">
                              Last Sale Price
                            </span>
                            <span className="valuation-value">
                              ${propertyData.lastSalePrice?.toLocaleString()}
                            </span>
                            <span className="valuation-date">
                              {getLastSaleDate()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Owner Information */}
                    {propertyData.owner && propertyData.owner.names && (
                      <div className="data-section">
                        <h4>Owner</h4>
                        <div className="owner-info">
                          <div className="owner-name">
                            <span className="owner-label">Name(s): </span>
                            <span className="owner-value">
                              {propertyData.owner.names.join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assessor and Legal */}
                    {propertyData.assessorID && (
                      <div className="data-section">
                        <h4>Assessor Information</h4>
                        <div className="assessor-info">
                          <div className="assessor-id">
                            <span className="assessor-label">Assessor ID: </span>
                            <span className="assessor-value">
                              {propertyData.assessorID}
                            </span>
                          </div>
                          <div className="legal-description">
                            <span className="legal-label">Legal Description: </span>
                            <span className="legal-value">
                              {propertyData.legalDescription}
                            </span>
                          </div>
                          <div className="subdivision">
                            <span className="subdivision-label">Subdivision: </span>
                            <span className="subdivision-value">
                              {propertyData.subdivision}
                            </span>
                          </div>
                          <div className="zoning">
                            <span className="zoning-label">Zoning: </span>
                            <span className="zoning-value">
                              {propertyData.zoning}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Property Features */}
                    {propertyData.features && (
                      <div className="data-section property-features">
                        <h4>Features</h4>
                        <div className="features-list">
                          {Object.entries(propertyData.features).map(
                            ([key, value]) => (
                              <div className="feature-item" key={key}>
                                <span className="feature-name">
                                  {key
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, (str) => str.toUpperCase())}
                                </span>
                                <span className="feature-value">
                                  {typeof value === 'boolean'
                                    ? value
                                      ? 'Yes'
                                      : 'No'
                                    : value}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="location-actions">
              <button onClick={viewOnMap} className="map-button">
                <span className="button-icon">🗺️</span> View on Map
              </button>
              <button onClick={detectLocation} className="refresh-button">
                <span className="button-icon">🔄</span> Refresh
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .home-location-section {
          background-color: white;
          border-radius: var(--border-radius);
          box-shadow: var(--card-shadow);
          margin-bottom: 1.5rem;
          overflow: hidden;
        }

        .location-header {
          padding: 1.25rem;
          background-color: rgba(67, 97, 238, 0.05);
          border-bottom: 1px solid var(--gray-200);
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .location-header h3 {
          margin: 0;
          font-size: 1.125rem;
          color: var(--gray-800);
          display: flex;
          align-items: center;
        }

        .location-icon {
          margin-right: 0.5rem;
        }

        .expand-icon {
          margin-left: 0.75rem;
          font-size: 0.75rem;
          transition: transform 0.3s ease;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .location-preview {
          font-size: 0.875rem;
          color: var(--gray-600);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 50%;
        }

        .location-content {
          padding: 1.5rem;
        }

        .location-prompt {
          text-align: center;
          padding: 1rem 0;
        }

        .location-prompt p {
          margin-bottom: 1rem;
          color: var(--gray-700);
        }

        .detect-button {
          background-color: var(--primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: var(--border-radius);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
        }

        .detect-button:hover {
          background-color: var(--primary-dark);
          transform: translateY(-2px);
        }

        .detect-button:disabled {
          background-color: var(--gray-400);
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s linear infinite;
          margin-right: 0.5rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-message {
          background-color: rgba(239, 71, 111, 0.1);
          color: var(--danger);
          padding: 1rem;
          border-radius: var(--border-radius);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
        }

        .error-icon {
          margin-right: 0.5rem;
        }

        .retry-button {
          margin-left: auto;
          background-color: white;
          color: var(--danger);
          border: 1px solid var(--danger);
          padding: 0.5rem 1rem;
          border-radius: var(--border-radius);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .retry-button:hover {
          background-color: var(--danger);
          color: white;
        }

        .location-details {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .location-data {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
        }

        .data-section {
          flex: 1;
          min-width: 250px;
        }

        .data-section h4 {
          font-size: 1rem;
          color: var(--gray-700);
          margin-top: 0;
          margin-bottom: 0.75rem;
        }

        .coordinate-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .coordinate-item {
          background-color: var(--gray-100);
          padding: 0.75rem;
          border-radius: var(--border-radius);
          display: flex;
          flex-direction: column;
        }

        .coordinate-label {
          font-size: 0.75rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .coordinate-value {
          font-weight: 600;
          font-family: monospace;
          color: var(--gray-800);
        }

        .address-display {
          background-color: var(--gray-100);
          padding: 0.75rem;
          border-radius: var(--border-radius);
        }

        .full-address {
          margin: 0 0 0.75rem 0;
          color: var(--gray-800);
          font-weight: 500;
          display: flex; /* Use flexbox for alignment */
          align-items: center;
          gap: 0.5rem;
        }

        .address-input-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .address-input {
          flex: 1;
          padding: 0.5rem;
          border-radius: var(--border-radius);
          border: 1px solid var(--gray-300);
          font-size: 0.875rem;
          min-width: 200px;
        }

        .address-disclaimer {
          font-size: 0.75rem;
          color: var(--gray-500);
          margin-top: 0.25rem;
        }

        .address-components {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .address-component {
          display: flex;
          flex-direction: column;
        }

        .component-label {
          font-size: 0.75rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .component-value {
          font-weight: 600;
          color: var(--gray-800);
        }

        /* Property Data Styles */
        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background-color: var(--gray-100);
          border-radius: var(--border-radius);
        }

        .loading-indicator .spinner {
          border-top-color: var(--primary);
        }

        .loading-indicator span {
          margin-left: 0.5rem;
          color: var(--gray-700);
        }

        .property-error {
          padding: 1rem;
          background-color: rgba(239, 71, 111, 0.1);
          border-radius: var(--border-radius);
          color: var(--danger);
        }

        .property-section {
          flex: 1 1 100%;
        }

        .property-info-container {
          background-color: white;
          border-radius: var(--border-radius);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .property-overview {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .property-type-badge {
          background-color: var(--primary);
          color: white;
          padding: 0.3rem 0.75rem;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .property-year {
          font-size: 0.9rem;
          color: var(--gray-600);
        }

        .property-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 0.75rem;
          background-color: white;
          border-radius: var(--border-radius);
          padding: 0.75rem;
        }

        .property-spec {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .spec-icon {
          font-size: 1.25rem;
          margin-bottom: 0.25rem;
        }

        .spec-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--gray-800);
          margin-bottom: 0.1rem;
        }

        .spec-label {
          font-size: 0.75rem;
          color: var(--gray-600);
        }

        .property-valuation {
          background-color: white;
          border-radius: var(--border-radius);
          padding: 0.75rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .valuation-item {
          flex: 1;
          min-width: 150px;
          display: flex;
          flex-direction: column;
        }

        .valuation-label {
          font-size: 0.75rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .valuation-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 0.1rem;
        }

        .valuation-date {
          font-size: 0.75rem;
          color: var(--gray-500);
        }

        .property-features {
          background-color: white;
          border-radius: var(--border-radius);
          padding: 0.75rem;
        }

        .property-features h5 {
          font-size: 0.9rem;
          color: var(--gray-700);
          margin-top: 0;
          margin-bottom: 0.75rem;
        }

        .features-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.5rem;
        }

        .feature-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          padding: 0.25rem 0;
          border-bottom: 1px dotted var(--gray-300);
        }

        .feature-name {
          color: var(--gray-600);
        }

        .feature-value {
          color: var(--gray-800);
          font-weight: 500;
        }

        .feature-more {
          grid-column: 1 / -1;
          text-align: center;
          color: var(--primary);
          font-size: 0.85rem;
          font-weight: 500;
          padding: 0.5rem;
          cursor: pointer;
        }

        .feature-more:hover {
          text-decoration: underline;
        }

        .location-actions {
          display: flex;
          gap: 1rem;
        }

        .map-button,
        .refresh-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          border-radius: var(--border-radius);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .map-button {
          background-color: #48bb78;
          color: white;
        }

        .map-button:hover {
          background-color: #38a169;
          transform: translateY(-2px);
        }

        .refresh-button {
          background-color: var(--gray-100);
          color: var(--gray-700);
          border: 1px solid var(--gray-300);
        }

        .refresh-button:hover {
          background-color: var(--gray-200);
          transform: translateY(-2px);
        }

        .button-icon {
          margin-right: 0.5rem;
        }

        /* Owner Styles */
        .owner-info {
          background-color: white;
          border-radius: var(--border-radius);
          padding: 0.75rem;
        }

        .owner-name {
          font-size: 0.9rem;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .owner-label {
          font-weight: 600;
          color: var(--gray-700);
        }

        .owner-value {
          color: var(--gray-800);
        }

        .owner-address {
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .owner-occupied {
          font-size: 0.875rem;
          color: var(--gray-600);
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        /* Assessor Styles */
        .assessor-info {
          background-color: white;
          border-radius: var(--border-radius);
          padding: 0.75rem;
        }

        .assessor-id {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .legal-description {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .subdivision {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .zoning {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .update-button {
          background-color: var(--secondary);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: var(--border-radius);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .update-button:hover {
          background-color: var(--secondary-dark);
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .coordinate-grid {
            grid-template-columns: 1fr;
          }

          .location-actions {
            flex-direction: column;
          }

          .property-specs-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .features-list {
            grid-template-columns: 1fr;
          }

          .address-input-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default HomeLocationDetector;
