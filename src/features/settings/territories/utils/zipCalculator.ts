import * as turf from '@turf/turf';
import type { Geometry, Polygon, MultiPolygon, Feature } from 'geojson';
import type { MetroZipCentroid } from '../types/territory.types';

/**
 * Calculate which zip codes fall within a drawn shape
 * Uses Turf.js booleanPointInPolygon for point-in-polygon checks
 */
export function calculateZipsInShape(
  shape: Geometry,
  zipCentroids: MetroZipCentroid[]
): string[] {
  // Handle circle geometry (stored as a polygon approximation)
  let polygon: Feature<Polygon | MultiPolygon>;

  if (shape.type === 'Point') {
    // This shouldn't happen in our use case, but handle it
    return [];
  }

  if (shape.type === 'Polygon' || shape.type === 'MultiPolygon') {
    polygon = turf.feature(shape);
  } else {
    console.warn('Unsupported geometry type:', shape.type);
    return [];
  }

  // Check each zip centroid
  const matchingZips: string[] = [];

  for (const zip of zipCentroids) {
    const point = turf.point([zip.lng, zip.lat]);

    try {
      if (turf.booleanPointInPolygon(point, polygon)) {
        matchingZips.push(zip.zip_code);
      }
    } catch (err) {
      console.warn(`Error checking zip ${zip.zip_code}:`, err);
    }
  }

  return matchingZips.sort();
}

/**
 * Create a circle polygon from center and radius
 * Used when converting Leaflet circle to GeoJSON polygon
 */
export function createCirclePolygon(
  center: [number, number], // [lng, lat]
  radiusKm: number,
  steps: number = 64
): Polygon {
  const circle = turf.circle(center, radiusKm, { steps, units: 'kilometers' });
  return circle.geometry;
}

/**
 * Calculate the centroid of a polygon
 */
export function getPolygonCentroid(
  geometry: Polygon | MultiPolygon
): [number, number] {
  const centroid = turf.centroid(turf.feature(geometry));
  return centroid.geometry.coordinates as [number, number];
}

/**
 * Calculate the area of a polygon in square kilometers
 */
export function getPolygonArea(
  geometry: Polygon | MultiPolygon
): number {
  return turf.area(turf.feature(geometry)) / 1_000_000; // Convert m² to km²
}

/**
 * Check if two polygons overlap
 */
export function doPolygonsOverlap(
  poly1: Polygon | MultiPolygon,
  poly2: Polygon | MultiPolygon
): boolean {
  try {
    const intersection = turf.intersect(
      turf.featureCollection([turf.feature(poly1), turf.feature(poly2)])
    );
    return intersection !== null;
  } catch {
    return false;
  }
}

/**
 * Get bounding box for a set of zip centroids
 */
export function getZipsBoundingBox(
  zips: MetroZipCentroid[]
): [[number, number], [number, number]] | null {
  if (zips.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const zip of zips) {
    if (zip.lat < minLat) minLat = zip.lat;
    if (zip.lat > maxLat) maxLat = zip.lat;
    if (zip.lng < minLng) minLng = zip.lng;
    if (zip.lng > maxLng) maxLng = zip.lng;
  }

  // Add padding
  const latPadding = (maxLat - minLat) * 0.1;
  const lngPadding = (maxLng - minLng) * 0.1;

  return [
    [minLat - latPadding, minLng - lngPadding],
    [maxLat + latPadding, maxLng + lngPadding],
  ];
}
