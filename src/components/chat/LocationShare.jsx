"use client";
import { useState, useRef } from "react";
import { MapPin, X, Loader2 } from "lucide-react";

export default function LocationShare({ onLocationSelected, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const lastGeocodeTimeRef = useRef(0);

  const getCurrentLocation = () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Try to get address using reverse geocoding with multiple free services
        // Try Photon first (open-source, free, works client-side), then fallback to others
        let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        // Try Photon Geocoder (free, open-source, no API key needed)
        try {
          const photonResponse = await fetch(
            `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              }
            }
          );
          
          if (photonResponse.ok) {
            const photonData = await photonResponse.json();
            if (photonData?.features && photonData.features.length > 0) {
              const feature = photonData.features[0];
              const props = feature?.properties;
              if (props) {
                // Build address from Photon properties
                const addressParts = [];
                if (props.name) addressParts.push(props.name);
                if (props.street) addressParts.push(props.street);
                if (props.city) addressParts.push(props.city);
                if (props.state) addressParts.push(props.state);
                if (props.country) addressParts.push(props.country);
                
                address = addressParts.length > 0 
                  ? addressParts.join(', ') 
                  : props.name || address;
              }
            }
          }
        } catch (photonError) {
          console.warn('Photon geocoding failed, trying alternatives:', photonError);
          
          // Fallback: Try BigDataCloud (free, no API key for basic use)
          try {
            const bigDataResponse = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
              {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                }
              }
            );
            
            if (bigDataResponse.ok) {
              const bigDataData = await bigDataResponse.json();
              if (bigDataData?.locality || bigDataData?.city) {
                const addressParts = [];
                if (bigDataData.locality) addressParts.push(bigDataData.locality);
                if (bigDataData.city && bigDataData.city !== bigDataData.locality) addressParts.push(bigDataData.city);
                if (bigDataData.principalSubdivision) addressParts.push(bigDataData.principalSubdivision);
                if (bigDataData.countryName) addressParts.push(bigDataData.countryName);
                
                address = addressParts.length > 0 ? addressParts.join(', ') : address;
              }
            }
          } catch (bigDataError) {
            console.warn('BigDataCloud geocoding also failed, using coordinates:', bigDataError);
            // Final fallback: use coordinates (already set above)
          }
        }
        
        setLocation({
          latitude,
          longitude,
          address
        });
        setIsLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Could not get your location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Request timed out. Please try again.";
            break;
          default:
            errorMessage += "Please check permissions and try again.";
            break;
        }
        setError(errorMessage);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // Increased to 30 seconds
        maximumAge: 60000 // Allow cached location up to 1 minute old
      }
    );
  };

  const handleSend = () => {
    if (location) {
      onLocationSelected(location);
    }
  };

  const getMapUrl = () => {
    if (!location) return null;
    // Using OpenStreetMap (free, no API key needed)
    return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=15`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share Location
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!location ? (
          <div className="text-center py-8">
            {isLoading ? (
              <>
                <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Getting your location...
                </p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <MapPin className="w-12 h-12 text-white" />
                </div>
                {error && (
                  <p className="text-sm text-red-500 mb-4">{error}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Share your current location
                </p>
                <button
                  onClick={getCurrentLocation}
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center gap-2 mx-auto transition-colors disabled:opacity-50"
                >
                  <MapPin className="w-5 h-5" />
                  Get Location
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="py-4">
            <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Your Location
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
                    {location.address}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
            
            {getMapUrl() && (
              <div className="mb-4">
                <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden relative group border-2 border-blue-500 hover:border-blue-600 transition-all hover:shadow-lg">
                  {/* Interactive OpenStreetMap embed - free, no API key needed */}
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.01},${location.latitude - 0.01},${location.longitude + 0.01},${location.latitude + 0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
                    className="w-full h-full border-0 pointer-events-auto"
                    title="Location map"
                    loading="lazy"
                    allowFullScreen
                  />
                  {/* Separate button to open full map - positioned at bottom right, doesn't block map controls */}
                  <a
                    href={getMapUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded shadow-lg transition-colors z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Full Map
                  </a>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Send Location
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

