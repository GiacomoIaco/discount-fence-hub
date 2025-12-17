import { useState, useCallback } from 'react';
import { useDistanceMatrix } from '../../shared/hooks/useDistanceMatrix';
import type { Coordinate } from '../../shared/types/location';
import type { Job, Crew } from '../types';

interface CrewDistance {
  crew: Crew;
  distance_miles: number;
  travel_minutes: number;
}

/**
 * Hook for crew routing and travel time calculations
 * Used for finding nearest crews to job sites and optimizing routes
 */
export function useCrewRouting() {
  const { calculateMatrix, getTravelTime, isLoading: matrixLoading } = useDistanceMatrix();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Find the nearest crews to a job location
   * Returns crews sorted by travel time (shortest first)
   */
  const findNearestCrews = useCallback(async (
    jobCoordinate: Coordinate,
    availableCrews: Crew[],
    limit: number = 5
  ): Promise<CrewDistance[]> => {
    // Filter crews that have home location set
    const crewsWithLocation = availableCrews.filter(
      (c) => c.home_latitude && c.home_longitude
    );

    if (crewsWithLocation.length === 0) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const origins = crewsWithLocation.map((c) => ({
        latitude: c.home_latitude!,
        longitude: c.home_longitude!,
        label: c.name || c.code,
      }));

      const matrix = await calculateMatrix(origins, [jobCoordinate]);

      const results: CrewDistance[] = crewsWithLocation
        .map((crew, index) => {
          const entry = matrix.find((m) => m.origin_index === index);
          return {
            crew,
            distance_miles: entry?.distance_miles || 999,
            travel_minutes: entry?.duration_minutes || 999,
          };
        })
        .sort((a, b) => a.travel_minutes - b.travel_minutes)
        .slice(0, limit);

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nearest crew search failed';
      setError(message);
      console.error('Find nearest crews error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [calculateMatrix]);

  /**
   * Calculate travel time between two jobs or from a crew home to a job
   */
  const getJobTravelTime = useCallback(async (
    fromJob: Job | Crew,
    toJob: Job
  ): Promise<{ distance_miles: number; duration_minutes: number } | null> => {
    // Handle both Job and Crew as origin
    const fromLat = 'home_latitude' in fromJob ? fromJob.home_latitude : (fromJob as Job).site_latitude;
    const fromLng = 'home_longitude' in fromJob ? fromJob.home_longitude : (fromJob as Job).site_longitude;

    if (!fromLat || !fromLng || !toJob.site_latitude || !toJob.site_longitude) {
      return null;
    }

    return getTravelTime(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toJob.site_latitude, longitude: toJob.site_longitude }
    );
  }, [getTravelTime]);

  /**
   * Calculate total route time for a sequence of jobs
   */
  const calculateRouteTime = useCallback(async (
    startLocation: Coordinate,
    jobs: Job[]
  ): Promise<{ total_miles: number; total_minutes: number } | null> => {
    if (jobs.length === 0) return null;

    // Filter jobs with valid coordinates
    const validJobs = jobs.filter(
      (j) => j.site_latitude && j.site_longitude
    );

    if (validJobs.length === 0) return null;

    let totalMiles = 0;
    let totalMinutes = 0;

    // Calculate from start to first job
    const firstJob = validJobs[0];
    const firstLeg = await getTravelTime(
      startLocation,
      { latitude: firstJob.site_latitude!, longitude: firstJob.site_longitude! }
    );

    if (firstLeg) {
      totalMiles += firstLeg.distance_miles;
      totalMinutes += firstLeg.duration_minutes;
    }

    // Calculate between jobs
    for (let i = 0; i < validJobs.length - 1; i++) {
      const from = validJobs[i];
      const to = validJobs[i + 1];

      const leg = await getTravelTime(
        { latitude: from.site_latitude!, longitude: from.site_longitude! },
        { latitude: to.site_latitude!, longitude: to.site_longitude! }
      );

      if (leg) {
        totalMiles += leg.distance_miles;
        totalMinutes += leg.duration_minutes;
      }
    }

    return {
      total_miles: Math.round(totalMiles * 10) / 10,
      total_minutes: Math.round(totalMinutes),
    };
  }, [getTravelTime]);

  return {
    findNearestCrews,
    getJobTravelTime,
    calculateRouteTime,
    getTravelTime,
    isLoading: isLoading || matrixLoading,
    error,
    clearError: () => setError(null),
  };
}

export default useCrewRouting;
