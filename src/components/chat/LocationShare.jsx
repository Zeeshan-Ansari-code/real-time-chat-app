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
        
        // Try to get address using reverse geocoding (free OpenStreetMap Nominatim API)
        // Note: Nominatim requires proper User-Agent and has rate limits (1 req/sec)
        // Respect rate limit by adding delay if needed
        const now = Date.now();
        const timeSinceLastRequest = now - lastGeocodeTimeRef.current;
        if (timeSinceLastRequest < 1000) {
          // Wait if less than 1 second since last request
          await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
        }
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'RealTimeChatApp/1.0 (Contact: your-email@example.com)',
                'Accept': 'application/json',
                'Referer': typeof window !== 'undefined' ? window.location.origin : ''
              }
            }
          );
          
          lastGeocodeTimeRef.current = Date.now();
          
          if (!response.ok) {
            // If 403 or rate limited, skip geocoding and use coordinates
            if (response.status === 403 || response.status === 429) {
              throw new Error('Rate limited - using coordinates only');
            }
            throw new Error(`Nominatim API error: ${response.status}`);
          }
          
          const data = await response.json();
          const address = data?.display_name || data?.address?.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          setLocation({
            latitude,
            longitude,
            address
          });
        } catch (err) {
          console.warn('Reverse geocoding failed, using coordinates:', err);
          // If reverse geocoding fails, just use coordinates
          setLocation({
            latitude,
            longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          });
        }
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
                <a
                  href={getMapUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg overflow-hidden relative group border-2 border-blue-500 hover:border-blue-600 transition-all hover:shadow-lg"
                >
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <MapPin className="w-16 h-16 text-blue-500 mb-2" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center mb-1">
                      Location Preview
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </p>
                    <span className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to view on map →
                    </span>
                  </div>
                </a>
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

