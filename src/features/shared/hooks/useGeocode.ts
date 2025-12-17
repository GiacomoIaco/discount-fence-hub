import { useState, useCallback } from 'react';
import type { GeocodingResult } from '../types/location';

const RADAR_PUBLISHABLE_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY;

export function useGeocode() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocodeAddress = useCallback(async (
    address: string
  ): Promise<GeocodingResult | null> => {
    if (!address.trim()) {
      return null;
    }

    if (!RADAR_PUBLISHABLE_KEY) {
      setError('Geocoding not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`,
        {
          headers: { 'Authorization': RADAR_PUBLISHABLE_KEY },
        }
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.addresses && data.addresses.length > 0) {
        const result = data.addresses[0];
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formatted_address: result.formattedAddress,
          accuracy: result.confidence || 'approximate',
          confidence: result.confidenceScore,
        };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Geocoding failed';
      setError(message);
      console.error('Geocode error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reverseGeocode = useCallback(async (
    latitude: number,
    longitude: number
  ): Promise<GeocodingResult | null> => {
    if (!RADAR_PUBLISHABLE_KEY) {
      setError('Geocoding not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.radar.io/v1/geocode/reverse?coordinates=${latitude},${longitude}`,
        {
          headers: { 'Authorization': RADAR_PUBLISHABLE_KEY },
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.addresses && data.addresses.length > 0) {
        const result = data.addresses[0];
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formatted_address: result.formattedAddress,
          accuracy: result.confidence || 'approximate',
        };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reverse geocoding failed';
      setError(message);
      console.error('Reverse geocode error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    geocodeAddress,
    reverseGeocode,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

export default useGeocode;
