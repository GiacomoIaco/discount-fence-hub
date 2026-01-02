import type { Geometry } from 'geojson';

export interface Territory {
  id: string;
  name: string;
  code: string;
  business_unit_id: string | null; // Legacy - use location_code instead
  location_code: string | null; // 'ATX', 'SA', 'HOU'
  disabled_qbo_class_ids: string[]; // QBO class IDs disabled for this territory
  zip_codes: string[];
  geometry: Geometry | null;
  color: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerritoryWithReps extends Territory {
  business_unit_name: string | null;
  business_unit_code: string | null;
  location_name: string | null; // 'Austin', 'San Antonio', 'Houston'
  metro: string | null;
  assigned_reps: AssignedRep[];
  zip_count: number | null;
  // Demographics (from aggregated metro_zip_centroids)
  total_households: number | null;
  total_population: number | null;
  avg_median_income: number | null;
}

export interface AssignedRep {
  id: string;
  name: string;
  is_primary: boolean;
}

export interface TerritoryAssignment {
  id: string;
  territory_id: string;
  sales_rep_id: string;
  is_primary: boolean;
  assigned_at: string;
  assigned_by: string | null;
}

export interface MetroZipCentroid {
  zip_code: string;
  metro: 'austin' | 'san_antonio' | 'houston';
  city: string | null;
  county: string | null;
  lat: number;
  lng: number;
  population: number | null;
  household_count: number | null;
  median_income: number | null;
}

export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  location: string;
  business_type: string;
  is_active: boolean;
}

// Re-export RepUser from fsm for backwards compatibility
export type { RepUser } from '../../../fsm/types';

// Map drawing types
export type DrawingMode = 'circle' | 'rectangle' | 'polygon' | null;

export interface DrawnShape {
  type: 'circle' | 'rectangle' | 'polygon';
  geometry: Geometry;
  properties: {
    radius?: number; // For circles, in meters
  };
}

export interface TerritoryFormData {
  name: string;
  code: string;
  business_unit_id: string | null; // Legacy - use location_code instead
  location_code: string | null; // 'ATX', 'SA', 'HOU'
  disabled_qbo_class_ids: string[]; // QBO class IDs disabled for this territory
  color: string;
  description: string;
  geometry: Geometry | null;
  zip_codes: string[];
}

// Metro quick-jump options
export const METRO_OPTIONS = [
  { value: 'austin', label: 'Austin', center: [30.2672, -97.7431] as [number, number] },
  { value: 'san_antonio', label: 'San Antonio', center: [29.4241, -98.4936] as [number, number] },
  { value: 'houston', label: 'Houston', center: [29.7604, -95.3698] as [number, number] },
] as const;

// Texas ZIP code GeoJSON boundaries (polygon data)
export const TEXAS_GEOJSON_URL = 'https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/tx_texas_zip_codes_geo.min.json';

// Default colors for territories
export const TERRITORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];
