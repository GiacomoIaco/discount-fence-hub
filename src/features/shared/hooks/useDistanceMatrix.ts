import { useState, useCallback } from 'react';
import type { Coordinate, DistanceMatrixResult } from '../types/location';

const RADAR_PUBLISHABLE_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY;

export function useDistanceMatrix() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateMatrix = useCallback(async (
    origins: Coordinate[],
    destinations: Coordinate[],
    mode: 'driving' | 'trucking' = 'driving'
  ): Promise<DistanceMatrixResult[]> => {
    if (!RADAR_PUBLISHABLE_KEY) {
      setError('Distance matrix not configured');
      return [];
    }

    if (origins.length === 0 || destinations.length === 0) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const originsStr = origins
        .map((o) => `${o.latitude},${o.longitude}`)
        .join('|');
      const destinationsStr = destinations
        .map((d) => `${d.latitude},${d.longitude}`)
        .join('|');

      const response = await fetch(
        `https://api.radar.io/v1/route/matrix?` +
          `origins=${encodeURIComponent(originsStr)}&` +
          `destinations=${encodeURIComponent(destinationsStr)}&` +
          `mode=${mode}&units=imperial`,
        {
          headers: { 'Authorization': RADAR_PUBLISHABLE_KEY },
        }
      );

      if (!response.ok) {
        throw new Error(`Distance matrix failed: ${response.status}`);
      }

      const data = await response.json();

      const results: DistanceMatrixResult[] = [];

      if (data.matrix) {
        data.matrix.forEach((row: any[], originIndex: number) => {
          row.forEach((cell: any, destIndex: number) => {
            if (cell && cell.distance && cell.duration) {
              results.push({
                origin_index: originIndex,
                destination_index: destIndex,
                distance_meters: cell.distance.value,
                distance_miles: Math.round((cell.distance.value / 1609.34) * 10) / 10,
                duration_seconds: cell.duration.value,
                duration_minutes: Math.round(cell.duration.value / 60),
              });
            }
          });
        });
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Distance calculation failed';
      setError(message);
      console.error('Distance matrix error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTravelTime = useCallback(async (
    from: Coordinate,
    to: Coordinate,
    mode: 'driving' | 'trucking' = 'driving'
  ): Promise<{ distance_miles: number; duration_minutes: number } | null> => {
    const results = await calculateMatrix([from], [to], mode);

    if (results.length > 0) {
      return {
        distance_miles: results[0].distance_miles,
        duration_minutes: results[0].duration_minutes,
      };
    }

    return null;
  }, [calculateMatrix]);

  return {
    calculateMatrix,
    getTravelTime,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

export default useDistanceMatrix;
