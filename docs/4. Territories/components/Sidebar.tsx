
import React, { useState } from 'react';
import { SalesArea, TerritoryState } from '../types';
import { AUSTIN_COLORS, CITIES } from '../constants';
import { analyzeTerritory } from '../services/geminiService';
import { 
  PlusIcon, 
  TrashIcon, 
  EyeSlashIcon, 
  BeakerIcon,
  CheckCircleIcon,
  XMarkIcon,
  HashtagIcon,
  PencilIcon,
  CheckIcon,
  CursorArrowRaysIcon,
  ArrowPathIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  state: TerritoryState;
  dispatch: React.Dispatch<any>;
}

const Sidebar: React.FC<SidebarProps> = ({ state, dispatch }) => {
  const [newAreaName, setNewAreaName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AUSTIN_COLORS[0]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [manualZip, setManualZip] = useState<{ [key: string]: string }>({});
  
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currentCity = CITIES.find(c => c.id === state.selectedCityId) || CITIES[0];

  const handleCreateArea = () => {
    if (!newAreaName.trim()) return;
    const newArea: SalesArea = {
      id: crypto.randomUUID(),
      name: newAreaName,
      color: selectedColor,
      zipCodes: [],
      isVisible: true,
    };
    dispatch({ type: 'ADD_AREA', payload: newArea });
    dispatch({ type: 'SET_ACTIVE_AREA', payload: newArea.id });
    setNewAreaName('');
  };

  const handleToggleCard = (area: SalesArea) => {
    const willBeVisible = !area.isVisible;
    dispatch({ type: 'TOGGLE_VISIBILITY', payload: area.id });
    if (willBeVisible) {
      dispatch({ type: 'SET_ACTIVE_AREA', payload: area.id });
    } else if (state.activeAreaId === area.id) {
      dispatch({ type: 'SET_ACTIVE_AREA', payload: null });
    }
  };

  const handleAnalyze = async (area: SalesArea) => {
    if (area.zipCodes.length === 0) return;
    setIsAnalyzing(area.id);
    const description = await analyzeTerritory(area.name, area.zipCodes, `${currentCity.name}, TX`);
    dispatch({ type: 'UPDATE_AREA', payload: { ...area, description } });
    setIsAnalyzing(null);
  };

  const handleManualZipAdd = (areaId: string, e: React.FormEvent) => {
    e.preventDefault();
    const zip = manualZip[areaId]?.trim();
    if (zip && zip.length >= 3) {
      dispatch({ type: 'TOGGLE_ZIP_IN_AREA', payload: { areaId, zipCode: zip } });
      setManualZip({ ...manualZip, [areaId]: '' });
    }
  };

  const removeZip = (areaId: string, zipCode: string) => {
    dispatch({ type: 'TOGGLE_ZIP_IN_AREA', payload: { areaId, zipCode } });
  };

  const startEditing = (area: SalesArea, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAreaId(area.id);
    setEditingName(area.name);
  };

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-10 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="p-2 bg-blue-600 rounded-lg text-white">PRO</span>
          Texas Sales
        </h1>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Region Planning Tool</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* City Focus */}
        <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
          <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
            <BuildingOffice2Icon className="w-3.5 h-3.5" />
            Focus City
          </h2>
          <div className="grid grid-cols-1 gap-1.5">
            {CITIES.map(city => (
              <button
                key={city.id}
                onClick={() => dispatch({ type: 'SET_CITY', payload: city.id })}
                className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  state.selectedCityId === city.id 
                    ? 'bg-blue-600 text-white shadow-md scale-[1.02]' 
                    : 'bg-white border border-slate-100 text-slate-600 hover:border-blue-200'
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-indigo-400 font-medium leading-tight">
            Map displays ZIP codes within 70 miles of {currentCity.name}.
          </p>
        </div>

        {/* Create Area */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Sales Area</h2>
          <input
            type="text"
            placeholder="e.g. Metro North"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm font-medium"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateArea()}
          />
          <div className="flex flex-wrap gap-2">
            {AUSTIN_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-125 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-slate-400 shadow-md scale-110' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            onClick={handleCreateArea}
            disabled={!newAreaName}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <PlusIcon className="w-4 h-4" /> Create Territory
          </button>
        </div>

        {/* Territory List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Manage Areas</h2>
          {state.areas.length === 0 ? (
            <div className="text-center py-8 opacity-40 italic text-sm">No areas yet</div>
          ) : (
            state.areas.map(area => {
              const isActive = state.activeAreaId === area.id;
              const isVisible = area.isVisible;
              return (
                <div 
                  key={area.id}
                  onClick={() => handleToggleCard(area)}
                  className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isVisible ? 'shadow-md translate-x-1' : 'opacity-50'
                  } ${isActive ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                  style={{ 
                    borderColor: isVisible ? area.color : '#f1f5f9',
                    backgroundColor: isVisible ? `${area.color}05` : '#ffffff' 
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0 border border-slate-200" style={{ backgroundColor: area.color }} />
                      {editingAreaId === area.id ? (
                        <input
                          autoFocus
                          className="px-1 text-xs border rounded outline-none font-bold w-24"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => {
                            dispatch({ type: 'UPDATE_AREA', payload: { ...area, name: editingName.trim() } });
                            setEditingAreaId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="font-bold text-xs truncate text-slate-800">{area.name}</span>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); startEditing(area, e); }} className="p-1 hover:bg-slate-100 rounded text-slate-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_AREA', payload: area.id }); }} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {isVisible && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                        {area.zipCodes.map(zip => (
                          <span key={zip} className="px-1.5 py-0.5 rounded-md text-[9px] font-black border bg-white text-slate-600">
                            {zip}
                          </span>
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase pt-1 border-t border-slate-100">
                        <span>{area.zipCodes.length} ZIPs</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleAnalyze(area); }}
                          disabled={isAnalyzing === area.id || area.zipCodes.length === 0}
                          className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        >
                          {isAnalyzing === area.id ? '...' : 'Insights'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
