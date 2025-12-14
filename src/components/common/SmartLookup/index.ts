// Smart Lookup Components
// Unified search pattern for Client/Community/Property lookup

export { ClientLookup } from './components/ClientLookup';
export { PropertyLookup } from './components/PropertyLookup';
export { SlideOutPanel } from './components/SlideOutPanel';
export { NewClientForm } from './components/NewClientForm';
export { NewPropertyForm } from './components/NewPropertyForm';

// Hooks
export { useClientSearch } from './hooks/useClientSearch';
export { usePropertySearch } from './hooks/usePropertySearch';

// Types
export type {
  ClientSearchResult,
  SelectedEntity,
  ClientLookupProps,
  PropertySearchResult,
  PropertyLookupProps,
  BuilderCascadeProps,
  DuplicateInfo,
  SlideOutPanelProps,
  NewClientFormData,
  NewPropertyFormData,
  EntityType,
} from './types';
