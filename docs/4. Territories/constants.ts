
export const AUSTIN_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export interface CityConfig {
  name: string;
  id: string;
  center: [number, number];
  zoom: number;
}

export const CITIES: CityConfig[] = [
  { name: 'Austin', id: 'austin', center: [30.2672, -97.7431], zoom: 10 },
  { name: 'San Antonio', id: 'san-antonio', center: [29.4241, -98.4936], zoom: 10 },
  { name: 'Houston', id: 'houston', center: [29.7604, -95.3698], zoom: 10 },
];

// We use Texas as the master data source for these cities
export const TEXAS_GEOJSON_URL = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/tx_texas_zip_codes_geo.min.json`;

export const MAP_DEFAULTS = {
  center: CITIES[0].center,
  zoom: CITIES[0].zoom
};
