import { useState, useCallback } from 'react';

interface DeviceLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: number;
}

interface UseDeviceLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useDeviceLocation(options: UseDeviceLocationOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DeviceLocationResult | null>(null);

  const {
    enableHighAccuracy = true, // High accuracy for 811 requests
    timeout = 10000,
    maximumAge = 0, // Always get fresh location
  } = options;

  const isSupported = 'geolocation' in navigator;

  const isMobileOrTablet = useCallback(() => {
    // Check user agent for mobile/tablet
    const mobileRegex = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileUA = mobileRegex.test(navigator.userAgent);

    // Also check screen width as fallback
    const isSmallScreen = window.innerWidth < 1024;

    return isMobileUA || isSmallScreen;
  }, []);

  const captureLocation = useCallback((): Promise<DeviceLocationResult | null> => {
    return new Promise((resolve) => {
      if (!isSupported) {
        setError('Geolocation is not supported by this browser');
        resolve(null);
        return;
      }

      setIsCapturing(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const result: DeviceLocationResult = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          setLastResult(result);
          setIsCapturing(false);
          resolve(result);
        },
        (err) => {
          let message = 'Could not get location';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable in settings.';
              break;
            case err.POSITION_UNAVAILABLE:
              message = 'Location unavailable. Move to an open area.';
              break;
            case err.TIMEOUT:
              message = 'Location request timed out. Try again.';
              break;
          }
          setError(message);
          setIsCapturing(false);
          resolve(null);
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );
    });
  }, [isSupported, enableHighAccuracy, timeout, maximumAge]);

  const clearError = useCallback(() => setError(null), []);

  return {
    captureLocation,
    isCapturing,
    isSupported,
    isMobileOrTablet,
    lastResult,
    error,
    clearError,
  };
}

/**
 * Accuracy thresholds for 811 utility flagging
 */
export const ACCURACY_THRESHOLDS = {
  EXCELLENT: 5,   // < 5m - Excellent for 811
  GOOD: 10,       // < 10m - Good for 811
  ACCEPTABLE: 20, // < 20m - Acceptable
  POOR: 50,       // < 50m - Poor, warn user
} as const;

/**
 * Get accuracy level for display
 */
export function getAccuracyLevel(accuracy: number): {
  level: 'excellent' | 'good' | 'acceptable' | 'poor';
  color: string;
  message: string;
} {
  if (accuracy < ACCURACY_THRESHOLDS.EXCELLENT) {
    return { level: 'excellent', color: 'text-green-600', message: 'Excellent for 811' };
  }
  if (accuracy < ACCURACY_THRESHOLDS.GOOD) {
    return { level: 'good', color: 'text-green-600', message: 'Good for 811' };
  }
  if (accuracy < ACCURACY_THRESHOLDS.ACCEPTABLE) {
    return { level: 'acceptable', color: 'text-amber-600', message: 'Acceptable accuracy' };
  }
  return { level: 'poor', color: 'text-red-600', message: 'Poor - move to open area' };
}

export default useDeviceLocation;
