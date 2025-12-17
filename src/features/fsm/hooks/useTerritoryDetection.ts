import { useCallback } from 'react';
import { useTerritories } from './useTerritories';
import { TEXAS_SERVICE_AREAS, type ServiceAreaKey } from '../../shared/types/location';

interface TerritoryMatch {
  territory_id: string;
  territory_name: string;
  territory_code: string;
  confidence: 'exact' | 'prefix';
}

interface BusinessUnitSuggestion {
  location: string;
  bu_prefix: string;
  service_area: ServiceAreaKey;
}

/**
 * Hook for detecting territories and business units based on zip codes
 * Used for auto-routing service requests to the correct territory/BU
 */
export function useTerritoryDetection() {
  const { data: territories } = useTerritories();

  /**
   * Detect which territory a zip code belongs to
   */
  const detectTerritory = useCallback((zipCode: string): TerritoryMatch | null => {
    if (!territories || !zipCode) {
      return null;
    }

    const cleanZip = zipCode.replace(/\D/g, '').substring(0, 5);

    if (cleanZip.length < 5) {
      return null;
    }

    // Exact match first
    let match = territories.find((territory) =>
      territory.zip_codes?.includes(cleanZip)
    );

    if (match) {
      return {
        territory_id: match.id,
        territory_name: match.name,
        territory_code: match.code,
        confidence: 'exact',
      };
    }

    // Prefix match as fallback
    const zipPrefix = cleanZip.substring(0, 3);
    match = territories.find((territory) =>
      territory.zip_codes?.some((zip: string) =>
        zip.startsWith(zipPrefix) || zipPrefix.startsWith(zip.substring(0, 3))
      )
    );

    if (match) {
      return {
        territory_id: match.id,
        territory_name: match.name,
        territory_code: match.code,
        confidence: 'prefix',
      };
    }

    return null;
  }, [territories]);

  /**
   * Suggest which business unit should handle a request based on zip code
   */
  const suggestBusinessUnit = useCallback((zipCode: string): BusinessUnitSuggestion | null => {
    if (!zipCode) {
      return null;
    }

    const cleanZip = zipCode.replace(/\D/g, '').substring(0, 3);

    for (const [key, area] of Object.entries(TEXAS_SERVICE_AREAS)) {
      if (area.zip_prefixes.some((prefix) => cleanZip.startsWith(prefix.substring(0, 2)))) {
        return {
          location: area.name,
          bu_prefix: area.bu_prefix,
          service_area: key as ServiceAreaKey,
        };
      }
    }

    return null;
  }, []);

  /**
   * Check if a zip code is within any service area
   */
  const isInServiceArea = useCallback((zipCode: string): boolean => {
    if (!zipCode) return false;

    const cleanZip = zipCode.replace(/\D/g, '').substring(0, 3);

    return Object.values(TEXAS_SERVICE_AREAS).some((area) =>
      area.zip_prefixes.some((prefix) => cleanZip.startsWith(prefix.substring(0, 2)))
    );
  }, []);

  return {
    detectTerritory,
    suggestBusinessUnit,
    isInServiceArea,
    territories,
  };
}

export default useTerritoryDetection;
