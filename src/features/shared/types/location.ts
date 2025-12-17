// ============================================================================
// LOCATION & ADDRESS TYPES
// For smart address search, geocoding, and routing
// ============================================================================

/**
 * Address suggestion from autocomplete API
 */
export interface AddressSuggestion {
  place_id: string;
  formatted_address: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  latitude: number;
  longitude: number;
  accuracy: 'rooftop' | 'interpolated' | 'parcel' | 'approximate';
  source: 'radar' | 'google' | 'mapbox' | 'manual' | 'gps';
}

/**
 * Result from forward/reverse geocoding
 */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  accuracy: string;
  confidence?: number;
}

/**
 * GPS coordinate point
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
  label?: string;
}

/**
 * Single result from distance matrix
 */
export interface DistanceMatrixResult {
  origin_index: number;
  destination_index: number;
  distance_meters: number;
  distance_miles: number;
  duration_seconds: number;
  duration_minutes: number;
}

/**
 * Address data structure for forms
 */
export interface AddressFormData {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Default empty address form data
 */
export const EMPTY_ADDRESS: AddressFormData = {
  address_line1: '',
  city: '',
  state: 'TX',
  zip: '',
  latitude: null,
  longitude: null,
};

/**
 * Texas service area definitions for business unit mapping
 */
export const TEXAS_SERVICE_AREAS = {
  AUSTIN: {
    name: 'Austin Metro',
    bu_prefix: 'ATX',
    zip_prefixes: ['787', '786', '785', '784', '789'],
    center: { latitude: 30.2672, longitude: -97.7431 },
  },
  SAN_ANTONIO: {
    name: 'San Antonio Metro',
    bu_prefix: 'SA',
    zip_prefixes: ['782', '781', '780'],
    center: { latitude: 29.4241, longitude: -98.4936 },
  },
  HOUSTON: {
    name: 'Houston Metro',
    bu_prefix: 'HOU',
    zip_prefixes: ['770', '771', '772', '773', '774', '775', '776', '777', '778', '779'],
    center: { latitude: 29.7604, longitude: -95.3698 },
  },
} as const;

export type ServiceAreaKey = keyof typeof TEXAS_SERVICE_AREAS;

/**
 * Check if coordinates are valid
 */
export function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Validate coordinates are within Texas bounds
 */
export function validateTexasCoordinates(lat: number, lng: number): boolean {
  // Texas bounds: 25.84N to 36.5N, 93.51W to 106.65W
  return lat >= 25.84 && lat <= 36.5 && lng >= -106.65 && lng <= -93.51;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number, precision: number = 5): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}
