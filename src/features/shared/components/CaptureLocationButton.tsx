import { Navigation, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useDeviceLocation, getAccuracyLevel } from '../hooks/useDeviceLocation';
import { formatCoordinates } from '../types/location';

interface CaptureLocationButtonProps {
  onCapture: (coords: { latitude: number; longitude: number; accuracy: number }) => void;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  disabled?: boolean;
}

export function CaptureLocationButton({
  onCapture,
  currentLatitude,
  currentLongitude,
  disabled = false,
}: CaptureLocationButtonProps) {
  const {
    captureLocation,
    isCapturing,
    isSupported,
    isMobileOrTablet,
    lastResult,
    error,
    clearError,
  } = useDeviceLocation();

  // Only show on mobile/tablet devices
  if (!isMobileOrTablet()) {
    return null;
  }

  if (!isSupported) {
    return (
      <div className="text-sm text-gray-500 italic">
        GPS not available on this device
      </div>
    );
  }

  const handleCapture = async () => {
    clearError();
    const result = await captureLocation();
    if (result) {
      onCapture({
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: result.accuracy,
      });
    }
  };

  const hasCoords = currentLatitude != null && currentLongitude != null;
  const accuracyInfo = lastResult ? getAccuracyLevel(lastResult.accuracy) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">- OR -</span>
      </div>

      <button
        type="button"
        onClick={handleCapture}
        disabled={disabled || isCapturing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          border-2 border-dashed transition-colors
          ${isCapturing
            ? 'border-blue-300 bg-blue-50 text-blue-600'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isCapturing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Getting location...</span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4" />
            <span>Capture Current Location</span>
          </>
        )}
      </button>

      <p className="text-xs text-gray-500">
        Use when on-site at the property for accurate GPS coordinates
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hasCoords && lastResult && accuracyInfo && (
        <div className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
          <CheckCircle className={`w-4 h-4 flex-shrink-0 ${accuracyInfo.color}`} />
          <div>
            <span className="text-gray-700">
              {formatCoordinates(currentLatitude!, currentLongitude!, 5)}
            </span>
            <span className={`ml-2 ${accuracyInfo.color}`}>
              +/-{Math.round(lastResult.accuracy)}m ({accuracyInfo.message})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaptureLocationButton;
