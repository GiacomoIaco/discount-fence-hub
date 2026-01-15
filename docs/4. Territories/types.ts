
export interface SalesArea {
  id: string;
  name: string;
  color: string;
  zipCodes: string[];
  isVisible: boolean;
  description?: string;
}

export interface TerritoryState {
  areas: SalesArea[];
  activeAreaId: string | null;
  selectionMode: boolean;
  selectedCityId: string;
}

export type Action =
  | { type: 'ADD_AREA'; payload: SalesArea }
  | { type: 'UPDATE_AREA'; payload: SalesArea }
  | { type: 'DELETE_AREA'; payload: string }
  | { type: 'SET_ACTIVE_AREA'; payload: string | null }
  | { type: 'TOGGLE_ZIP_IN_AREA'; payload: { areaId: string; zipCode: string } }
  | { type: 'TOGGLE_VISIBILITY'; payload: string }
  | { type: 'SET_SELECTION_MODE'; payload: boolean }
  | { type: 'SET_CITY'; payload: string };
