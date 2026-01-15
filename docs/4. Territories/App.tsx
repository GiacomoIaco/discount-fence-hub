
import React, { useReducer, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapDisplay from './components/MapDisplay';
import { TerritoryState, Action } from './types';
import { CITIES } from './constants';

const initialState: TerritoryState = {
  areas: [],
  activeAreaId: null,
  selectionMode: false,
  selectedCityId: CITIES[0].id,
};

function reducer(state: TerritoryState, action: Action): TerritoryState {
  switch (action.type) {
    case 'ADD_AREA':
      return { ...state, areas: [...state.areas, action.payload] };
    case 'UPDATE_AREA':
      return { ...state, areas: state.areas.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'DELETE_AREA':
      return {
        ...state,
        areas: state.areas.filter(a => a.id !== action.payload),
        activeAreaId: state.activeAreaId === action.payload ? null : state.activeAreaId,
      };
    case 'SET_ACTIVE_AREA':
      return { ...state, activeAreaId: action.payload };
    case 'TOGGLE_VISIBILITY':
      return {
        ...state,
        areas: state.areas.map(a => 
          a.id === action.payload ? { ...a, isVisible: !a.isVisible } : a
        ),
      };
    case 'TOGGLE_ZIP_IN_AREA':
      return {
        ...state,
        areas: state.areas.map(area => {
          if (area.id === action.payload.areaId) {
            const hasZip = area.zipCodes.includes(action.payload.zipCode);
            return {
              ...area,
              zipCodes: hasZip 
                ? area.zipCodes.filter(z => z !== action.payload.zipCode)
                : [...area.zipCodes, action.payload.zipCode]
            };
          }
          return area;
        }),
      };
    case 'SET_SELECTION_MODE':
      return { ...state, selectionMode: action.payload };
    case 'SET_CITY':
      return { ...state, selectedCityId: action.payload };
    default:
      return state;
  }
}

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem('territory-pro-v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (state.areas.length === 0 && parsed.areas) {
          parsed.areas.forEach((area: any) => dispatch({ type: 'ADD_AREA', payload: area }));
        }
        if (parsed.selectedCityId) {
          dispatch({ type: 'SET_CITY', payload: parsed.selectedCityId });
        }
      } catch (e) {
        console.error("Failed to restore state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('territory-pro-v2', JSON.stringify({
      areas: state.areas,
      selectedCityId: state.selectedCityId
    }));
  }, [state.areas, state.selectedCityId]);

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans">
      <Sidebar state={state} dispatch={dispatch} />
      <main className="flex-1 relative bg-slate-100">
        <MapDisplay state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};

export default App;
