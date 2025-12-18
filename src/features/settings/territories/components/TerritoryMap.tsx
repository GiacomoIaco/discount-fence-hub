import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import type { Geometry, Polygon as GeoPolygon } from 'geojson';
import type { MetroZipCentroid, TerritoryWithReps } from '../types/territory.types';
import { METRO_OPTIONS } from '../types/territory.types';
import { calculateZipsInShape, createCirclePolygon } from '../utils/zipCalculator';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TerritoryMapProps {
  zipCentroids: MetroZipCentroid[];
  territories: TerritoryWithReps[];
  selectedTerritoryId?: string;
  onShapeDrawn?: (geometry: Geometry, selectedZips: string[]) => void;
  onTerritoryClick?: (territory: TerritoryWithReps) => void;
  isDrawingEnabled?: boolean;
  highlightedZips?: string[];
}

// Component to handle map view changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
}

// Custom zip marker
function createZipMarkerIcon(isSelected: boolean, isHighlighted: boolean) {
  const color = isHighlighted ? '#10B981' : (isSelected ? '#3B82F6' : '#9CA3AF');
  const size = isHighlighted ? 10 : 6;

  return L.divIcon({
    className: 'zip-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      border: 1px solid white;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function TerritoryMap({
  zipCentroids,
  territories,
  selectedTerritoryId,
  onShapeDrawn,
  onTerritoryClick,
  isDrawingEnabled = false,
  highlightedZips = [],
}: TerritoryMapProps) {
  const [activeMetro, setActiveMetro] = useState<string>('austin');
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.2672, -97.7431]);
  const [mapZoom, setMapZoom] = useState(10);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  // Handle metro quick-jump
  const handleMetroChange = useCallback((metro: string) => {
    setActiveMetro(metro);
    const option = METRO_OPTIONS.find(m => m.value === metro);
    if (option) {
      setMapCenter(option.center);
      setMapZoom(10);
    }
  }, []);

  // Handle shape creation
  const handleCreated = useCallback((e: any) => {
    const { layer, layerType } = e;

    let geometry: Geometry;

    if (layerType === 'circle') {
      // Convert Leaflet circle to GeoJSON polygon
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      geometry = createCirclePolygon(
        [center.lng, center.lat],
        radius / 1000 // Convert meters to km
      );
    } else if (layerType === 'rectangle' || layerType === 'polygon') {
      geometry = layer.toGeoJSON().geometry;
    } else {
      return;
    }

    // Calculate which zips fall inside the shape
    const selectedZips = calculateZipsInShape(geometry, zipCentroids);

    // Clear the drawn layer (we'll render our own)
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }

    // Notify parent
    onShapeDrawn?.(geometry, selectedZips);
  }, [zipCentroids, onShapeDrawn]);

  // Filter zips by current metro
  const visibleZips = zipCentroids.filter(z => z.metro === activeMetro);

  // Get highlighted set for quick lookup
  const highlightedSet = new Set(highlightedZips);

  return (
    <div className="flex flex-col h-full">
      {/* Metro selector */}
      <div className="flex gap-2 p-2 bg-gray-50 border-b">
        {METRO_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => handleMetroChange(option.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeMetro === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}
          >
            {option.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="text-sm text-gray-500 self-center">
          {visibleZips.length} zip codes
          {highlightedZips.length > 0 && ` • ${highlightedZips.length} selected`}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
          style={{ minHeight: '400px' }}
        >
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Base tile layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Existing territories */}
          {territories.map(territory => {
            if (!territory.geometry) return null;

            const isSelected = territory.id === selectedTerritoryId;
            const opacity = isSelected ? 0.4 : 0.2;

            // Render polygon or circle based on geometry type
            if (territory.geometry.type === 'Polygon') {
              const coords = (territory.geometry as GeoPolygon).coordinates[0].map(
                ([lng, lat]) => [lat, lng] as [number, number]
              );

              return (
                <Polygon
                  key={territory.id}
                  positions={coords}
                  pathOptions={{
                    color: territory.color,
                    fillColor: territory.color,
                    fillOpacity: opacity,
                    weight: isSelected ? 3 : 1,
                  }}
                  eventHandlers={{
                    click: () => onTerritoryClick?.(territory),
                  }}
                />
              );
            }

            return null;
          })}

          {/* Zip code markers */}
          {visibleZips.map(zip => (
            <Marker
              key={zip.zip_code}
              position={[zip.lat, zip.lng]}
              icon={createZipMarkerIcon(
                false,
                highlightedSet.has(zip.zip_code)
              )}
            >
            </Marker>
          ))}

          {/* Drawing controls */}
          {isDrawingEnabled && (
            <FeatureGroup ref={featureGroupRef}>
              <EditControl
                position="topright"
                onCreated={handleCreated}
                draw={{
                  rectangle: true,
                  polygon: true,
                  circle: true,
                  polyline: false,
                  marker: false,
                  circlemarker: false,
                }}
                edit={{
                  edit: false,
                  remove: false,
                }}
              />
            </FeatureGroup>
          )}
        </MapContainer>

        {/* Drawing mode indicator */}
        {isDrawingEnabled && (
          <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md border border-blue-200 z-[1000]">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="font-medium text-blue-700">Drawing Mode</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use the tools on the right to draw a shape
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TerritoryMap;
