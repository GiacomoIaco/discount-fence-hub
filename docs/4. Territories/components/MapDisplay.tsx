
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TerritoryState } from '../types';
import { TEXAS_GEOJSON_URL, CITIES } from '../constants';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const SearchControl = ({ onLocationFound }: { onLocationFound: (lat: number, lon: number) => void }) => {
  const [query, setQuery] = useState('');
  const map = useMap();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data?.[0]) {
        const { lat, lon } = data[0];
        const nLat = parseFloat(lat);
        const nLon = parseFloat(lon);
        map.flyTo([nLat, nLon], 12);
        onLocationFound(nLat, nLon);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[1000]">
      <form onSubmit={handleSearch} className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Jump to address..."
          className="w-full h-10 pl-9 pr-4 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 outline-none text-xs font-medium"
        />
      </form>
    </div>
  );
};

const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface MapDisplayProps {
  state: TerritoryState;
  dispatch: React.Dispatch<any>;
}

const MapDisplay: React.FC<MapDisplayProps> = ({ state, dispatch }) => {
  const [rawGeoData, setRawGeoData] = useState<any>(null);
  const [filteredGeoData, setFilteredGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredZip, setHoveredZip] = useState<string | null>(null);

  const activeCity = CITIES.find(c => c.id === state.selectedCityId) || CITIES[0];

  useEffect(() => {
    const fetchGeoData = async () => {
      setLoading(true);
      try {
        const response = await fetch(TEXAS_GEOJSON_URL);
        const data = await response.json();
        setRawGeoData(data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchGeoData();
  }, []);

  useEffect(() => {
    if (!rawGeoData) return;
    
    // Perform distance filtering to improve performance
    // 70 miles is roughly 1.1 degrees of latitude
    const radius = 1.1; 
    const [cLat, cLon] = activeCity.center;

    const filtered = {
      ...rawGeoData,
      features: rawGeoData.features.filter((f: any) => {
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
  }, [rawGeoData, state.selectedCityId]);

  const getZipFromFeature = useCallback((f: any) => {
    const p = f.properties;
    return String(p.ZCTA5CE10 || p.zipcode || p.ZCTA5 || p.name || '').trim();
  }, []);

  const getZipStyle = useCallback((f: any) => {
    const zip = getZipFromFeature(f);
    const isHovered = hoveredZip === zip;
    const areas = state.areas.filter(a => a.isVisible && a.zipCodes.includes(zip));
    const activeArea = state.areas.find(a => a.id === state.activeAreaId);
    const inActive = activeArea?.zipCodes.includes(zip);

    if (areas.length === 0) {
      return { fillColor: isHovered ? '#e2e8f0' : '#ffffff', weight: isHovered ? 2 : 1, color: '#cbd5e1', fillOpacity: isHovered ? 0.3 : 0.05 };
    }

    const color = inActive && activeArea ? activeArea.color : areas[areas.length - 1].color;
    return {
      fillColor: color,
      weight: isHovered ? 3 : (inActive ? 2 : 1),
      color: isHovered ? '#334155' : (inActive ? '#000' : '#fff'),
      fillOpacity: areas.length > 1 ? 0.8 : 0.5,
    };
  }, [state.areas, state.activeAreaId, hoveredZip]);

  const onEachFeature = (f: any, l: any) => {
    const zip = getZipFromFeature(f);
    l.on({
      click: (e: any) => {
        L.DomEvent.stopPropagation(e);
        if (state.activeAreaId) dispatch({ type: 'TOGGLE_ZIP_IN_AREA', payload: { areaId: state.activeAreaId, zipCode: zip } });
      },
      mouseover: () => setHoveredZip(zip),
      mouseout: () => setHoveredZip(null)
    });
  };

  const geojsonKey = useMemo(() => {
    return `geo-${state.selectedCityId}-${state.activeAreaId}-${state.areas.length}-${hoveredZip}`;
  }, [state.selectedCityId, state.activeAreaId, state.areas.length, hoveredZip]);

  return (
    <div className="flex-1 relative h-full bg-slate-100">
      <MapContainer center={activeCity.center} zoom={activeCity.zoom} className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapController center={activeCity.center} zoom={activeCity.zoom} />
        <SearchControl onLocationFound={() => {}} />
        
        {loading && (
          <div className="absolute inset-0 z-[2000] bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {filteredGeoData && !loading && (
          <GeoJSON 
            key={geojsonKey}
            data={filteredGeoData} 
            style={getZipStyle}
            onEachFeature={onEachFeature}
          >
            <Tooltip sticky>
              {(layer: any) => {
                const zip = getZipFromFeature(layer.feature);
                const areas = state.areas.filter(a => a.isVisible && a.zipCodes.includes(zip)).map(a => a.name);
                return (
                  <div className="p-1 font-bold text-xs">
                    ZIP: {zip}
                    {areas.length > 0 && <div className="text-[10px] text-blue-600 pt-1 uppercase">• {areas.join(', ')}</div>}
                  </div>
                );
              }}
            </Tooltip>
          </GeoJSON>
        )}
      </MapContainer>

      {/* Mini Controls */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-200 z-[1000] min-w-[140px]">
        {state.activeAreaId ? (
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Editing Area</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: state.areas.find(a => a.id === state.activeAreaId)?.color }}></div>
              <span className="text-[11px] font-bold text-slate-800">{state.areas.find(a => a.id === state.activeAreaId)?.name}</span>
            </div>
            <button onClick={() => dispatch({ type: 'SET_ACTIVE_AREA', payload: null })} className="w-full mt-2 text-[10px] font-bold bg-slate-100 py-1 rounded text-slate-500 hover:bg-slate-200">Done</button>
          </div>
        ) : (
          <p className="text-[10px] font-black text-slate-400 text-center uppercase">Select area to map</p>
        )}
      </div>
    </div>
  );
};

export default MapDisplay;
