import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TerritoryWithReps } from '../types/territory.types';
import { METRO_OPTIONS, TEXAS_GEOJSON_URL } from '../types/territory.types';

// Component to handle map view changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
}

interface TerritoryMapProps {
  territories: TerritoryWithReps[];
  selectedTerritoryId?: string;
  onZipClick?: (zipCode: string) => void;
  isSelectionEnabled?: boolean;
  selectedZips?: string[];
}

// Extract ZIP code from GeoJSON feature properties
function getZipFromFeature(feature: any): string {
  const p = feature.properties;
  return String(p.ZCTA5CE10 || p.zipcode || p.ZCTA5 || p.name || '').trim();
}

export function TerritoryMap({
  territories,
  selectedTerritoryId,
  onZipClick,
  isSelectionEnabled = false,
  selectedZips = [],
}: TerritoryMapProps) {
  const [activeMetro, setActiveMetro] = useState<string>('austin');
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.2672, -97.7431]);
  const [mapZoom, setMapZoom] = useState(10);
  const [rawGeoData, setRawGeoData] = useState<any>(null);
  const [filteredGeoData, setFilteredGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredZip, setHoveredZip] = useState<string | null>(null);

  // Selected zips as a Set for quick lookup
  const selectedZipSet = useMemo(() => new Set(selectedZips), [selectedZips]);

  // Get zips assigned to visible territories
  const territoryZipMap = useMemo(() => {
    const map = new Map<string, TerritoryWithReps[]>();
    territories.forEach(t => {
      t.zip_codes.forEach(zip => {
        const existing = map.get(zip) || [];
        existing.push(t);
        map.set(zip, existing);
      });
    });
    return map;
  }, [territories]);

  // Handle metro quick-jump
  const handleMetroChange = useCallback((metro: string) => {
    setActiveMetro(metro);
    const option = METRO_OPTIONS.find(m => m.value === metro);
    if (option) {
      setMapCenter(option.center);
      setMapZoom(10);
    }
  }, []);

  // Fetch Texas GeoJSON data
  useEffect(() => {
    const fetchGeoData = async () => {
      setLoading(true);
      try {
        const response = await fetch(TEXAS_GEOJSON_URL);
        const data = await response.json();
        setRawGeoData(data);
      } catch (err) {
        console.error('Failed to fetch GeoJSON:', err);
      }
      setLoading(false);
    };
    fetchGeoData();
  }, []);

  // Filter GeoJSON to ~70 miles of selected metro
  useEffect(() => {
    if (!rawGeoData) return;

    const activeCity = METRO_OPTIONS.find(m => m.value === activeMetro) || METRO_OPTIONS[0];
    const [cLat, cLon] = activeCity.center;
    const radius = 1.1; // ~70 miles in degrees

    const filtered = {
      ...rawGeoData,
      features: rawGeoData.features.filter((f: any) => {
        // Get first coordinate of polygon
        const coords = f.geometry.type === 'Polygon'
          ? f.geometry.coordinates[0][0]
          : f.geometry.coordinates[0][0][0];

        const fLon = coords[0];
        const fLat = coords[1];

        return (
          Math.abs(fLat - cLat) < radius &&
          Math.abs(fLon - cLon) < radius
        );
      })
    };
    setFilteredGeoData(filtered);
  }, [rawGeoData, activeMetro]);

  // Style function for ZIP polygons
  const getZipStyle = useCallback((feature: any) => {
    const zip = getZipFromFeature(feature);
    const isHovered = hoveredZip === zip;
    const isSelected = selectedZipSet.has(zip);
    const assignedTerritories = territoryZipMap.get(zip) || [];
    const selectedTerritory = territories.find(t => t.id === selectedTerritoryId);
    const inSelectedTerritory = selectedTerritory?.zip_codes.includes(zip);

    // Selection mode (editing) - show green for selected
    if (isSelectionEnabled) {
      if (isSelected) {
        return {
          fillColor: '#10B981', // green
          weight: isHovered ? 3 : 2,
          color: isHovered ? '#059669' : '#059669',
          fillOpacity: 0.6,
        };
      }
      return {
        fillColor: isHovered ? '#e2e8f0' : '#ffffff',
        weight: isHovered ? 2 : 1,
        color: '#cbd5e1',
        fillOpacity: isHovered ? 0.4 : 0.15,
      };
    }

    // View mode - show territory colors
    if (assignedTerritories.length === 0) {
      return {
        fillColor: isHovered ? '#e2e8f0' : '#ffffff',
        weight: isHovered ? 2 : 1,
        color: '#cbd5e1',
        fillOpacity: isHovered ? 0.3 : 0.1,
      };
    }

    // Use the color of the selected territory if viewing it, otherwise last assigned
    const displayTerritory = inSelectedTerritory && selectedTerritory
      ? selectedTerritory
      : assignedTerritories[assignedTerritories.length - 1];

    return {
      fillColor: displayTerritory.color,
      weight: isHovered ? 3 : (inSelectedTerritory ? 2 : 1),
      color: isHovered ? '#334155' : (inSelectedTerritory ? '#000' : '#fff'),
      fillOpacity: assignedTerritories.length > 1 ? 0.7 : 0.5,
    };
  }, [hoveredZip, selectedZipSet, territoryZipMap, territories, selectedTerritoryId, isSelectionEnabled]);

  // Event handlers for each feature
  const onEachFeature = useCallback((feature: any, layer: any) => {
    const zip = getZipFromFeature(feature);
    const assignedTerritories = territoryZipMap.get(zip) || [];
    const isSelected = selectedZipSet.has(zip);

    // Build tooltip content
    let tooltipContent = `<div class="p-1"><div class="font-bold text-sm">ZIP: ${zip}</div>`;
    if (isSelected) {
      tooltipContent += '<div class="text-xs text-green-600 font-semibold">✓ Selected</div>';
    }
    if (assignedTerritories.length > 0) {
      tooltipContent += `<div class="text-xs text-blue-600 pt-1">${assignedTerritories.map(t => t.name).join(', ')}</div>`;
    }
    tooltipContent += '</div>';

    layer.bindTooltip(tooltipContent, { sticky: true });

    layer.on({
      click: (e: any) => {
        L.DomEvent.stopPropagation(e);
        if (isSelectionEnabled && onZipClick) {
          onZipClick(zip);
        }
      },
      mouseover: () => setHoveredZip(zip),
      mouseout: () => setHoveredZip(null),
    });
  }, [isSelectionEnabled, onZipClick, territoryZipMap, selectedZipSet]);

  // Key for forcing GeoJSON re-render when state changes
  const geojsonKey = useMemo(() => {
    return `geo-${activeMetro}-${selectedTerritoryId}-${territories.length}-${hoveredZip}-${selectedZips.length}`;
  }, [activeMetro, selectedTerritoryId, territories.length, hoveredZip, selectedZips.length]);

  // Count selected in current view
  const selectedInView = useMemo(() => {
    if (!filteredGeoData) return 0;
    return filteredGeoData.features.filter((f: any) =>
      selectedZipSet.has(getZipFromFeature(f))
    ).length;
  }, [filteredGeoData, selectedZipSet]);

  // Total zips in view
  const totalInView = filteredGeoData?.features?.length || 0;

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
          {totalInView} zip codes
          {selectedZips.length > 0 && ` • ${selectedInView} selected in view`}
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

          {/* Loading indicator */}
          {loading && (
            <div className="absolute inset-0 z-[2000] bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* ZIP code polygons */}
          {filteredGeoData && !loading && (
            <GeoJSON
              key={geojsonKey}
              data={filteredGeoData}
              style={getZipStyle}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>

        {/* Selection mode indicator */}
        {isSelectionEnabled && (
          <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md border border-green-200 z-[1000]">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium text-green-700">Click to Select</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Click ZIP areas on the map to toggle selection
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TerritoryMap;
