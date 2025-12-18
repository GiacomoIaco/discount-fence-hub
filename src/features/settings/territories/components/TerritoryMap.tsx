import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Polygon as GeoPolygon } from 'geojson';
import type { MetroZipCentroid, TerritoryWithReps } from '../types/territory.types';
import { METRO_OPTIONS } from '../types/territory.types';

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
  onZipClick?: (zipCode: string) => void;
  onTerritoryClick?: (territory: TerritoryWithReps) => void;
  isSelectionEnabled?: boolean;
  selectedZips?: string[];
}

// Component to handle map view changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
}

// Custom zip marker - larger and more clickable
function createZipMarkerIcon(isSelected: boolean, isSelectionEnabled: boolean) {
  const color = isSelected ? '#10B981' : '#9CA3AF';
  const size = isSelected ? 14 : (isSelectionEnabled ? 10 : 6);
  const cursor = isSelectionEnabled ? 'pointer' : 'default';

  return L.divIcon({
    className: 'zip-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid ${isSelected ? '#059669' : 'white'};
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      cursor: ${cursor};
      transition: all 0.15s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function TerritoryMap({
  zipCentroids,
  territories,
  selectedTerritoryId,
  onZipClick,
  onTerritoryClick,
  isSelectionEnabled = false,
  selectedZips = [],
}: TerritoryMapProps) {
  const [activeMetro, setActiveMetro] = useState<string>('austin');
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.2672, -97.7431]);
  const [mapZoom, setMapZoom] = useState(10);

  // Handle metro quick-jump
  const handleMetroChange = useCallback((metro: string) => {
    setActiveMetro(metro);
    const option = METRO_OPTIONS.find(m => m.value === metro);
    if (option) {
      setMapCenter(option.center);
      setMapZoom(10);
    }
  }, []);

  // Filter zips by current metro
  const visibleZips = zipCentroids.filter(z => z.metro === activeMetro);

  // Get selected set for quick lookup
  const selectedSet = new Set(selectedZips);

  // Count selected in current metro
  const selectedInMetro = visibleZips.filter(z => selectedSet.has(z.zip_code)).length;

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
          {selectedZips.length > 0 && ` • ${selectedInMetro} selected in view`}
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

            // Render polygon based on geometry type
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

          {/* Zip code markers - clickable when selection is enabled */}
          {visibleZips.map(zip => {
            const isZipSelected = selectedSet.has(zip.zip_code);

            return (
              <Marker
                key={zip.zip_code}
                position={[zip.lat, zip.lng]}
                icon={createZipMarkerIcon(isZipSelected, isSelectionEnabled)}
                eventHandlers={isSelectionEnabled ? {
                  click: () => onZipClick?.(zip.zip_code),
                } : {}}
              >
                {isSelectionEnabled && (
                  <Tooltip direction="top" offset={[0, -5]}>
                    <span className="font-mono text-sm">{zip.zip_code}</span>
                    {zip.city && <span className="text-gray-500 ml-1">({zip.city})</span>}
                    {isZipSelected && <span className="text-green-600 ml-1">✓</span>}
                  </Tooltip>
                )}
              </Marker>
            );
          })}
        </MapContainer>

        {/* Selection mode indicator */}
        {isSelectionEnabled && (
          <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md border border-green-200 z-[1000]">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium text-green-700">Click to Select</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Click zip codes on the map or paste below
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TerritoryMap;
