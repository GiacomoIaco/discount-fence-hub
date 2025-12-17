# Claude Code Handoff: Smart Address Search & Location Services
## Discount Fence USA - FSM Platform

**Document Version:** 1.2
**Created:** December 2024
**Target:** Claude Code Implementation
**Priority:** High
**Status:** ✅ COMPLETE (December 17, 2024)

---

## Implementation Complete

All Smart Address features have been implemented:

- ✅ Migration 178 applied (geocoding fields for crews and service_requests)
- ✅ Shared location types and hooks created (`src/features/shared/`)
- ✅ SmartAddressInput component with Radar.io autocomplete
- ✅ CaptureLocationButton for GPS capture on mobile/tablet
- ✅ All high-priority forms updated (Property, Request, Client editors)
- ✅ Coordinate display on detail pages (Property, Request)
- ✅ useCrewRouting hook for distance calculations
- ✅ useTerritoryDetection hook for auto-territory assignment

**Remaining:** Manual testing on live site per testing checklist below.

---

## Original Document (for reference)

---

## IMPORTANT: Pre-Implementation Notes

### Codebase Analysis Findings

1. **Property type ALREADY has `latitude` and `longitude` fields** - No migration needed for properties table
2. **`useTerritories` hook EXISTS** and returns territories with `zip_codes` array
3. **Crew type MISSING** `home_latitude`, `home_longitude` fields
4. **Job type MISSING** `site_latitude`, `site_longitude` fields
5. **RequestFormData MISSING** `latitude`, `longitude` fields
6. **PropertyFormData MISSING** `latitude`, `longitude` fields
7. **Migration path** should be `migrations/178_...` not `supabase/migrations/...`

### Files Impacted (20 files use address fields)

**High Priority (need SmartAddressInput):**
- `src/features/client_hub/components/PropertyEditorModal.tsx`
- `src/features/fsm/components/RequestEditorModal.tsx`
- `src/features/fsm/pages/RequestEditorPage.tsx`
- `src/components/common/SmartLookup/components/NewPropertyForm.tsx`
- `src/components/common/SmartLookup/components/NewClientForm.tsx`

**Medium Priority (display coordinates):**
- `src/features/client_hub/pages/PropertyDetailPage.tsx`
- `src/features/fsm/pages/RequestDetailPage.tsx`
- `src/features/fsm/pages/ProjectDetailPage.tsx`

**Low Priority (read-only address display):**
- `src/features/client_hub/components/CommunityEditorModal.tsx`
- `src/features/client_hub/components/ClientEditorModal.tsx`
- `src/features/client_hub/components/PropertiesList.tsx`
- Others...

---

## BREAKING CHANGES WARNING

### Type Changes Required

The following types need coordinate fields added BEFORE implementing SmartAddressInput:

```typescript
// src/features/fsm/types.ts - Crew interface (line ~86)
// ADD:
home_latitude?: number | null;
home_longitude?: number | null;
home_address?: string | null;

// src/features/fsm/types.ts - Job interface (line ~318)
// ADD:
site_latitude?: number | null;
site_longitude?: number | null;

// src/features/fsm/types.ts - RequestFormData (line ~527)
// ADD:
latitude?: number | null;
longitude?: number | null;

// src/features/client_hub/types.ts - PropertyFormData (line ~261)
// ADD:
latitude?: number | null;
longitude?: number | null;
```

### Potential Breaks

1. **useProperties hook** - Must handle new lat/lng fields in create/update mutations
2. **useServiceRequests hook** - Must handle new lat/lng fields
3. **useCrews hook** - Must handle new home location fields
4. **Any form validation** - May need to validate coordinate ranges

---

## IMPLEMENTATION TASKS (Revised Order)

### Task 1: Database Migration (REDUCED)

**File:** `migrations/178_add_geocoding_fields.sql`

Properties table ALREADY has lat/lng. Only add missing fields:

```sql
-- ============================================================================
-- Migration 178: Add Geocoding/Location Fields
-- NOTE: properties table already has latitude/longitude columns
-- ============================================================================

-- ===========================================
-- 1. PROPERTIES - Only add missing geocoding metadata
-- ===========================================
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_source TEXT,
  ADD COLUMN IF NOT EXISTS place_id TEXT,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

COMMENT ON COLUMN properties.geocode_source IS 'Source of geocoding: radar, google, manual';
COMMENT ON COLUMN properties.place_id IS 'External place ID for future lookups';

-- ===========================================
-- 2. SERVICE_REQUESTS - Add geocoding fields
-- ===========================================
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- ===========================================
-- 3. JOBS - Add site coordinates
-- ===========================================
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS site_latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS site_longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- ===========================================
-- 4. CREWS - Add home base location
-- ===========================================
ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS home_latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS home_longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS home_address TEXT;

COMMENT ON COLUMN crews.home_latitude IS 'Crew home base latitude for routing';
COMMENT ON COLUMN crews.home_longitude IS 'Crew home base longitude for routing';

-- ===========================================
-- 5. COMMUNITIES - Add geocoding fields
-- ===========================================
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- ===========================================
-- 6. TERRITORIES - Add center coordinates
-- ===========================================
ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS center_lat DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS center_lng DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS boundary_geojson JSONB;

-- ===========================================
-- 7. Create Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_properties_coords
  ON properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_coords
  ON jobs(site_latitude, site_longitude)
  WHERE site_latitude IS NOT NULL AND site_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crews_coords
  ON crews(home_latitude, home_longitude)
  WHERE home_latitude IS NOT NULL AND home_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_coords
  ON service_requests(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ===========================================
-- 8. Helper function
-- ===========================================
CREATE OR REPLACE FUNCTION has_coordinates(lat DECIMAL, lng DECIMAL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN lat IS NOT NULL AND lng IS NOT NULL
    AND lat BETWEEN -90 AND 90
    AND lng BETWEEN -180 AND 180;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

### Task 2: Update TypeScript Types

**File:** `src/features/fsm/types.ts`

Add to `Crew` interface (around line 86):
```typescript
export interface Crew {
  // ... existing fields ...
  // Geocoding (from migration 178)
  home_latitude?: number | null;
  home_longitude?: number | null;
  home_address?: string | null;
}
```

Add to `Job` interface (around line 318):
```typescript
export interface Job {
  // ... existing fields ...
  // Geocoding (from migration 178)
  site_latitude?: number | null;
  site_longitude?: number | null;
  geocoded_at?: string | null;
}
```

Add to `RequestFormData` interface (around line 527):
```typescript
export interface RequestFormData {
  // ... existing fields ...
  // Geocoding
  latitude?: number | null;
  longitude?: number | null;
}
```

**File:** `src/features/client_hub/types.ts`

Update `PropertyFormData` interface (around line 261):
```typescript
export interface PropertyFormData {
  // ... existing fields ...
  // Geocoding
  latitude?: number | null;
  longitude?: number | null;
}
```

---

### Task 3: Environment Configuration

**File:** `.env.local` (and Netlify environment variables)

```env
# IMPORTANT: Must have VITE_ prefix for Vite to expose to client
VITE_RADAR_PUBLISHABLE_KEY=prj_live_pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Setup steps:**
1. Go to https://radar.com
2. Create a free account
3. Dashboard -> Settings -> API Keys
4. Copy the "Publishable (Live)" key
5. Add domain restrictions: Settings -> API Keys -> Restrict to your domains
6. Add to Netlify: Site Settings -> Environment Variables

---

### Task 4: Create Location Types

**File:** `src/features/shared/types/location.ts`

```typescript
// ============================================================================
// LOCATION & ADDRESS TYPES
// For smart address search, geocoding, and routing
// ============================================================================

/**
 * Address suggestion from autocomplete API
 */
export interface AddressSuggestion {
  place_id: string;
  formatted_address: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  latitude: number;
  longitude: number;
  accuracy: 'rooftop' | 'interpolated' | 'parcel' | 'approximate';
  source: 'radar' | 'google' | 'mapbox' | 'manual';
}

/**
 * Result from forward/reverse geocoding
 */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  accuracy: string;
  confidence?: number;
}

/**
 * GPS coordinate point
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
  label?: string;
}

/**
 * Single result from distance matrix
 */
export interface DistanceMatrixResult {
  origin_index: number;
  destination_index: number;
  distance_meters: number;
  distance_miles: number;
  duration_seconds: number;
  duration_minutes: number;
}

/**
 * Address data structure for forms
 */
export interface AddressFormData {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Default empty address form data
 */
export const EMPTY_ADDRESS: AddressFormData = {
  address_line1: '',
  city: '',
  state: 'TX',
  zip: '',
  latitude: null,
  longitude: null,
};

/**
 * Texas service area definitions for business unit mapping
 */
export const TEXAS_SERVICE_AREAS = {
  AUSTIN: {
    name: 'Austin Metro',
    bu_prefix: 'ATX',
    zip_prefixes: ['787', '786', '785', '784', '789'],
    center: { latitude: 30.2672, longitude: -97.7431 },
  },
  SAN_ANTONIO: {
    name: 'San Antonio Metro',
    bu_prefix: 'SA',
    zip_prefixes: ['782', '781', '780'],
    center: { latitude: 29.4241, longitude: -98.4936 },
  },
  HOUSTON: {
    name: 'Houston Metro',
    bu_prefix: 'HOU',
    zip_prefixes: ['770', '771', '772', '773', '774', '775', '776', '777', '778', '779'],
    center: { latitude: 29.7604, longitude: -95.3698 },
  },
} as const;

export type ServiceAreaKey = keyof typeof TEXAS_SERVICE_AREAS;

/**
 * Check if coordinates are valid
 */
export function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Validate coordinates are within Texas bounds
 */
export function validateTexasCoordinates(lat: number, lng: number): boolean {
  // Texas bounds: 25.84N to 36.5N, 93.51W to 106.65W
  return lat >= 25.84 && lat <= 36.5 && lng >= -106.65 && lng <= -93.51;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number, precision: number = 5): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}
```

**Create barrel export:**
**File:** `src/features/shared/types/index.ts`

```typescript
export * from './location';
```

---

### Task 5: Create useDebounce Hook

**File:** `src/features/shared/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

/**
 * Debounce a value - delays updating until the value stops changing
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
```

**Create barrel export:**
**File:** `src/features/shared/hooks/index.ts`

```typescript
export { useDebounce } from './useDebounce';
export { useGeocode } from './useGeocode';
export { useDistanceMatrix } from './useDistanceMatrix';
```

---

### Task 6: Create AddressAutocomplete Component

**File:** `src/features/shared/components/AddressAutocomplete.tsx`

```typescript
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, X, Loader2, AlertCircle } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import type { AddressSuggestion } from '../types/location';

const RADAR_PUBLISHABLE_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY;
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 8;

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: AddressSuggestion) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  restrictToTexas?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  autoFocus?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Start typing an address...',
  label,
  required = false,
  restrictToTexas = true,
  disabled = false,
  className = '',
  error,
  autoFocus = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(value, DEBOUNCE_MS);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (!RADAR_PUBLISHABLE_KEY) {
      console.error('Radar API key not configured');
      setFetchError('Address search not configured');
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams({
        query,
        layers: 'address',
        limit: MAX_SUGGESTIONS.toString(),
        country: 'US',
      });

      if (restrictToTexas) {
        params.append('state', 'TX');
      }

      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?${params}`,
        {
          headers: {
            'Authorization': RADAR_PUBLISHABLE_KEY,
          },
        }
      );

      // Handle rate limiting
      if (response.status === 429) {
        setFetchError('Too many requests. Please slow down.');
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const formattedSuggestions: AddressSuggestion[] = (data.addresses || []).map(
        (addr: any) => ({
          place_id: addr.placeId || `${addr.latitude}-${addr.longitude}`,
          formatted_address: addr.formattedAddress || '',
          address_line1: addr.addressLabel ||
            (addr.number && addr.street
              ? `${addr.number} ${addr.street}`.trim()
              : addr.formattedAddress?.split(',')[0] || ''),
          city: addr.city || '',
          state: addr.state || addr.stateCode || 'TX',
          zip: addr.postalCode || '',
          county: addr.county || '',
          latitude: addr.latitude,
          longitude: addr.longitude,
          accuracy: addr.confidence === 'exact' ? 'rooftop' : 'interpolated',
          source: 'radar' as const,
        })
      );

      setSuggestions(formattedSuggestions);
      setIsOpen(formattedSuggestions.length > 0);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Address autocomplete error:', err);
      setFetchError('Unable to search addresses');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [restrictToTexas]);

  useEffect(() => {
    fetchSuggestions(debouncedQuery);
  }, [debouncedQuery, fetchSuggestions]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.querySelectorAll('[data-suggestion]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.address_line1);
    onAddressSelect(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const showError = error || fetchError;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label={label || 'Address search'}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          className={`
            w-full pl-10 pr-10 py-2
            border rounded-lg
            transition-colors
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${showError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-200'}
          `}
        />

        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}

        {value && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear address"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showError && (
        <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
          <AlertCircle className="w-3 h-3" />
          <span>{showError}</span>
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              role="option"
              data-suggestion
              aria-selected={index === selectedIndex}
              onClick={() => handleSelect(suggestion)}
              className={`
                w-full px-4 py-3 text-left flex items-start gap-3
                hover:bg-gray-50 transition-colors
                border-b border-gray-100 last:border-b-0
                ${index === selectedIndex ? 'bg-blue-50' : ''}
              `}
            >
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {suggestion.address_line1}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {suggestion.city}, {suggestion.state} {suggestion.zip}
                </div>
              </div>
            </button>
          ))}

          {restrictToTexas && (
            <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 text-center border-t">
              Showing Texas addresses only
            </div>
          )}
        </div>
      )}

      {isOpen && suggestions.length === 0 && !isLoading && value.length >= MIN_QUERY_LENGTH && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
          No addresses found. Try a different search.
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
```

---

### Task 7: Create SmartAddressInput Component

**File:** `src/features/shared/components/SmartAddressInput.tsx`

```typescript
import React, { useState } from 'react';
import { MapPin, Check, ChevronDown, ChevronUp, Edit2, Loader2 } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { AddressSuggestion, AddressFormData } from '../types/location';
import { hasValidCoordinates, formatCoordinates } from '../types/location';

interface SmartAddressInputProps {
  value: AddressFormData;
  onChange: (address: AddressFormData) => void;
  label?: string;
  required?: boolean;
  showManualFields?: boolean;
  restrictToTexas?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

export function SmartAddressInput({
  value,
  onChange,
  label = 'Address',
  required = false,
  showManualFields = false,
  restrictToTexas = true,
  disabled = false,
  error,
  placeholder = 'Start typing an address...',
}: SmartAddressInputProps) {
  const [showManual, setShowManual] = useState(showManualFields);
  const [isVerified, setIsVerified] = useState(
    hasValidCoordinates(value.latitude, value.longitude)
  );

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    onChange({
      address_line1: suggestion.address_line1,
      address_line2: suggestion.address_line2 || '',
      city: suggestion.city,
      state: suggestion.state,
      zip: suggestion.zip,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setIsVerified(true);
    setShowManual(false);
  };

  const handleManualChange = (field: keyof AddressFormData, newValue: string) => {
    onChange({
      ...value,
      [field]: newValue,
      // Clear coordinates when user manually edits
      latitude: null,
      longitude: null,
    });
    setIsVerified(false);
  };

  const handleInputChange = (newValue: string) => {
    onChange({
      ...value,
      address_line1: newValue,
      // Clear coordinates when typing (user is searching)
      latitude: null,
      longitude: null,
    });
    setIsVerified(false);
  };

  const hasCoords = hasValidCoordinates(value.latitude, value.longitude);

  return (
    <div className="space-y-3">
      <AddressAutocomplete
        value={value.address_line1}
        onChange={handleInputChange}
        onAddressSelect={handleAddressSelect}
        label={label}
        required={required}
        restrictToTexas={restrictToTexas}
        disabled={disabled}
        error={error}
        placeholder={placeholder}
      />

      {/* Location verified indicator */}
      {hasCoords && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600">
            <Check className="w-3 h-3" />
            <span>Location verified</span>
          </div>
          <span className="text-gray-400">
            ({formatCoordinates(value.latitude!, value.longitude!, 4)})
          </span>
        </div>
      )}

      {/* Collapsed address summary */}
      {!showManual && (value.city || value.state || value.zip) && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
          <span className="text-gray-600">
            {[value.city, value.state, value.zip].filter(Boolean).join(', ')}
          </span>
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            disabled={disabled}
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      )}

      {/* Toggle manual entry */}
      <button
        type="button"
        onClick={() => setShowManual(!showManual)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        disabled={disabled}
      >
        {showManual ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide manual entry
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Enter address manually
          </>
        )}
      </button>

      {/* Manual entry fields */}
      {showManual && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apt / Suite / Unit
            </label>
            <input
              type="text"
              value={value.address_line2 || ''}
              onChange={(e) => handleManualChange('address_line2', e.target.value)}
              placeholder="Apt 101"
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>

          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={value.city}
                onChange={(e) => handleManualChange('city', e.target.value)}
                placeholder="Austin"
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={value.state}
                onChange={(e) => handleManualChange('state', e.target.value)}
                placeholder="TX"
                maxLength={2}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 uppercase"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              <input
                type="text"
                value={value.zip}
                onChange={(e) => handleManualChange('zip', e.target.value)}
                placeholder="78701"
                maxLength={10}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Warning for manual entry */}
          {!hasCoords && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <MapPin className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-amber-800">
                <strong>Note:</strong> Manually entered addresses won't have GPS coordinates.
                Select an address from the dropdown for accurate location tracking and routing.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartAddressInput;
```

**Create barrel export:**
**File:** `src/features/shared/components/index.ts`

```typescript
export { AddressAutocomplete } from './AddressAutocomplete';
export { SmartAddressInput } from './SmartAddressInput';
```

---

### Task 8: Create useGeocode Hook

**File:** `src/features/shared/hooks/useGeocode.ts`

```typescript
import { useState, useCallback } from 'react';
import type { GeocodingResult } from '../types/location';

const RADAR_PUBLISHABLE_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY;

export function useGeocode() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocodeAddress = useCallback(async (
    address: string
  ): Promise<GeocodingResult | null> => {
    if (!address.trim()) {
      return null;
    }

    if (!RADAR_PUBLISHABLE_KEY) {
      setError('Geocoding not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`,
        {
          headers: { 'Authorization': RADAR_PUBLISHABLE_KEY },
        }
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.addresses && data.addresses.length > 0) {
        const result = data.addresses[0];
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formatted_address: result.formattedAddress,
          accuracy: result.confidence || 'approximate',
          confidence: result.confidenceScore,
        };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Geocoding failed';
      setError(message);
      console.error('Geocode error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reverseGeocode = useCallback(async (
    latitude: number,
    longitude: number
  ): Promise<GeocodingResult | null> => {
    if (!RADAR_PUBLISHABLE_KEY) {
      setError('Geocoding not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.radar.io/v1/geocode/reverse?coordinates=${latitude},${longitude}`,
        {
          headers: { 'Authorization': RADAR_PUBLISHABLE_KEY },
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.addresses && data.addresses.length > 0) {
        const result = data.addresses[0];
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formatted_address: result.formattedAddress,
          accuracy: result.confidence || 'approximate',
        };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reverse geocoding failed';
      setError(message);
      console.error('Reverse geocode error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    geocodeAddress,
    reverseGeocode,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

export default useGeocode;
```

---

### Task 9: Create useDistanceMatrix Hook

**File:** `src/features/shared/hooks/useDistanceMatrix.ts`

```typescript
import { useState, useCallback } from 'react';
import type { Coordinate, DistanceMatrixResult } from '../types/location';

const RADAR_PUBLISHABLE_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY;

export function useDistanceMatrix() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateMatrix = useCallback(async (
    origins: Coordinate[],
    destinations: Coordinate[],
    mode: 'driving' | 'trucking' = 'driving'
  ): Promise<DistanceMatrixResult[]> => {
    if (!RADAR_PUBLISHABLE_KEY) {
      setError('Distance matrix not configured');
      return [];
    }

    if (origins.length === 0 || destinations.length === 0) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const originsStr = origins
        .map((o) => `${o.latitude},${o.longitude}`)
        .join('|');
      const destinationsStr = destinations
        .map((d) => `${d.latitude},${d.longitude}`)
        .join('|');

      const response = await fetch(
        `https://api.radar.io/v1/route/matrix?` +
          `origins=${encodeURIComponent(originsStr)}&` +
          `destinations=${encodeURIComponent(destinationsStr)}&` +
          `mode=${mode}&units=imperial`,
        {
          headers: { 'Authorization': RADAR_PUBLISHABLE_KEY },
        }
      );

      if (!response.ok) {
        throw new Error(`Distance matrix failed: ${response.status}`);
      }

      const data = await response.json();

      const results: DistanceMatrixResult[] = [];

      if (data.matrix) {
        data.matrix.forEach((row: any[], originIndex: number) => {
          row.forEach((cell: any, destIndex: number) => {
            if (cell && cell.distance && cell.duration) {
              results.push({
                origin_index: originIndex,
                destination_index: destIndex,
                distance_meters: cell.distance.value,
                distance_miles: Math.round((cell.distance.value / 1609.34) * 10) / 10,
                duration_seconds: cell.duration.value,
                duration_minutes: Math.round(cell.duration.value / 60),
              });
            }
          });
        });
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Distance calculation failed';
      setError(message);
      console.error('Distance matrix error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTravelTime = useCallback(async (
    from: Coordinate,
    to: Coordinate,
    mode: 'driving' | 'trucking' = 'driving'
  ): Promise<{ distance_miles: number; duration_minutes: number } | null> => {
    const results = await calculateMatrix([from], [to], mode);

    if (results.length > 0) {
      return {
        distance_miles: results[0].distance_miles,
        duration_minutes: results[0].duration_minutes,
      };
    }

    return null;
  }, [calculateMatrix]);

  return {
    calculateMatrix,
    getTravelTime,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

export default useDistanceMatrix;
```

---

### Task 10: Create useDeviceLocation Hook (Mobile/Tablet GPS Capture)

**File:** `src/features/shared/hooks/useDeviceLocation.ts`

This hook enables field workers to capture GPS coordinates when on-site at a property.
Only shown on mobile/tablet devices.

```typescript
import { useState, useCallback } from 'react';

interface DeviceLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: number;
}

interface UseDeviceLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useDeviceLocation(options: UseDeviceLocationOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DeviceLocationResult | null>(null);

  const {
    enableHighAccuracy = true, // High accuracy for 811 requests
    timeout = 10000,
    maximumAge = 0, // Always get fresh location
  } = options;

  const isSupported = 'geolocation' in navigator;

  const isMobileOrTablet = useCallback(() => {
    // Check user agent for mobile/tablet
    const mobileRegex = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileUA = mobileRegex.test(navigator.userAgent);

    // Also check screen width as fallback
    const isSmallScreen = window.innerWidth < 1024;

    return isMobileUA || isSmallScreen;
  }, []);

  const captureLocation = useCallback((): Promise<DeviceLocationResult | null> => {
    return new Promise((resolve) => {
      if (!isSupported) {
        setError('Geolocation is not supported by this browser');
        resolve(null);
        return;
      }

      setIsCapturing(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const result: DeviceLocationResult = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          setLastResult(result);
          setIsCapturing(false);
          resolve(result);
        },
        (err) => {
          let message = 'Could not get location';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable in settings.';
              break;
            case err.POSITION_UNAVAILABLE:
              message = 'Location unavailable. Move to an open area.';
              break;
            case err.TIMEOUT:
              message = 'Location request timed out. Try again.';
              break;
          }
          setError(message);
          setIsCapturing(false);
          resolve(null);
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );
    });
  }, [isSupported, enableHighAccuracy, timeout, maximumAge]);

  const clearError = useCallback(() => setError(null), []);

  return {
    captureLocation,
    isCapturing,
    isSupported,
    isMobileOrTablet,
    lastResult,
    error,
    clearError,
  };
}

/**
 * Accuracy thresholds for 811 utility flagging
 */
export const ACCURACY_THRESHOLDS = {
  EXCELLENT: 5,   // < 5m - Excellent for 811
  GOOD: 10,       // < 10m - Good for 811
  ACCEPTABLE: 20, // < 20m - Acceptable
  POOR: 50,       // < 50m - Poor, warn user
} as const;

/**
 * Get accuracy level for display
 */
export function getAccuracyLevel(accuracy: number): {
  level: 'excellent' | 'good' | 'acceptable' | 'poor';
  color: string;
  message: string;
} {
  if (accuracy < ACCURACY_THRESHOLDS.EXCELLENT) {
    return { level: 'excellent', color: 'text-green-600', message: 'Excellent for 811' };
  }
  if (accuracy < ACCURACY_THRESHOLDS.GOOD) {
    return { level: 'good', color: 'text-green-600', message: 'Good for 811' };
  }
  if (accuracy < ACCURACY_THRESHOLDS.ACCEPTABLE) {
    return { level: 'acceptable', color: 'text-amber-600', message: 'Acceptable accuracy' };
  }
  return { level: 'poor', color: 'text-red-600', message: 'Poor - move to open area' };
}

export default useDeviceLocation;
```

**Update hooks barrel export:**
**File:** `src/features/shared/hooks/index.ts`

```typescript
export { useDebounce } from './useDebounce';
export { useGeocode } from './useGeocode';
export { useDistanceMatrix } from './useDistanceMatrix';
export { useDeviceLocation, getAccuracyLevel, ACCURACY_THRESHOLDS } from './useDeviceLocation';
```

---

### Task 11: Create CaptureLocationButton Component (Mobile/Tablet Only)

**File:** `src/features/shared/components/CaptureLocationButton.tsx`

```typescript
import React from 'react';
import { Navigation, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useDeviceLocation, getAccuracyLevel } from '../hooks/useDeviceLocation';
import { formatCoordinates } from '../types/location';

interface CaptureLocationButtonProps {
  onCapture: (coords: { latitude: number; longitude: number; accuracy: number }) => void;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  disabled?: boolean;
}

export function CaptureLocationButton({
  onCapture,
  currentLatitude,
  currentLongitude,
  disabled = false,
}: CaptureLocationButtonProps) {
  const {
    captureLocation,
    isCapturing,
    isSupported,
    isMobileOrTablet,
    lastResult,
    error,
    clearError,
  } = useDeviceLocation();

  // Only show on mobile/tablet devices
  if (!isMobileOrTablet()) {
    return null;
  }

  if (!isSupported) {
    return (
      <div className="text-sm text-gray-500 italic">
        GPS not available on this device
      </div>
    );
  }

  const handleCapture = async () => {
    clearError();
    const result = await captureLocation();
    if (result) {
      onCapture({
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: result.accuracy,
      });
    }
  };

  const hasCoords = currentLatitude != null && currentLongitude != null;
  const accuracyInfo = lastResult ? getAccuracyLevel(lastResult.accuracy) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">— OR —</span>
      </div>

      <button
        type="button"
        onClick={handleCapture}
        disabled={disabled || isCapturing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          border-2 border-dashed transition-colors
          ${isCapturing
            ? 'border-blue-300 bg-blue-50 text-blue-600'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isCapturing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Getting location...</span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4" />
            <span>Capture Current Location</span>
          </>
        )}
      </button>

      <p className="text-xs text-gray-500">
        Use when on-site at the property for accurate GPS coordinates
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hasCoords && lastResult && accuracyInfo && (
        <div className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
          <CheckCircle className={`w-4 h-4 flex-shrink-0 ${accuracyInfo.color}`} />
          <div>
            <span className="text-gray-700">
              {formatCoordinates(currentLatitude!, currentLongitude!, 5)}
            </span>
            <span className={`ml-2 ${accuracyInfo.color}`}>
              ±{Math.round(lastResult.accuracy)}m ({accuracyInfo.message})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaptureLocationButton;
```

**Update components barrel export:**
**File:** `src/features/shared/components/index.ts`

```typescript
export { AddressAutocomplete } from './AddressAutocomplete';
export { SmartAddressInput } from './SmartAddressInput';
export { CaptureLocationButton } from './CaptureLocationButton';
```

---

### Task 12: Update SmartAddressInput with GPS Capture

Update the SmartAddressInput component to include the GPS capture button.

**File:** `src/features/shared/components/SmartAddressInput.tsx`

Add import at top:
```typescript
import { CaptureLocationButton } from './CaptureLocationButton';
```

Add GPS capture handler inside component:
```typescript
const handleGpsCapture = (coords: { latitude: number; longitude: number; accuracy: number }) => {
  onChange({
    ...value,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  setIsVerified(true);
};
```

Add CaptureLocationButton after the manual entry toggle button (before the `{showManual && ...}` block):
```typescript
{/* GPS Capture - Mobile/Tablet only */}
<CaptureLocationButton
  onCapture={handleGpsCapture}
  currentLatitude={value.latitude}
  currentLongitude={value.longitude}
  disabled={disabled}
/>
```

---

### Task 13: Create useTerritoryDetection Hook

**File:** `src/features/fsm/hooks/useTerritoryDetection.ts`

```typescript
import { useCallback } from 'react';
import { useTerritories } from './useTerritories';
import { TEXAS_SERVICE_AREAS, type ServiceAreaKey } from '../../shared/types/location';

interface TerritoryMatch {
  territory_id: string;
  territory_name: string;
  territory_code: string;
  confidence: 'exact' | 'prefix';
}

interface BusinessUnitSuggestion {
  location: string;
  bu_prefix: string;
  service_area: ServiceAreaKey;
}

export function useTerritoryDetection() {
  const { data: territories } = useTerritories();

  const detectTerritory = useCallback((zipCode: string): TerritoryMatch | null => {
    if (!territories || !zipCode) {
      return null;
    }

    const cleanZip = zipCode.replace(/\D/g, '').substring(0, 5);

    if (cleanZip.length < 5) {
      return null;
    }

    // Exact match first
    let match = territories.find((territory) =>
      territory.zip_codes?.includes(cleanZip)
    );

    if (match) {
      return {
        territory_id: match.id,
        territory_name: match.name,
        territory_code: match.code,
        confidence: 'exact',
      };
    }

    // Prefix match as fallback
    const zipPrefix = cleanZip.substring(0, 3);
    match = territories.find((territory) =>
      territory.zip_codes?.some((zip: string) =>
        zip.startsWith(zipPrefix) || zipPrefix.startsWith(zip.substring(0, 3))
      )
    );

    if (match) {
      return {
        territory_id: match.id,
        territory_name: match.name,
        territory_code: match.code,
        confidence: 'prefix',
      };
    }

    return null;
  }, [territories]);

  const suggestBusinessUnit = useCallback((zipCode: string): BusinessUnitSuggestion | null => {
    if (!zipCode) {
      return null;
    }

    const cleanZip = zipCode.replace(/\D/g, '').substring(0, 3);

    for (const [key, area] of Object.entries(TEXAS_SERVICE_AREAS)) {
      if (area.zip_prefixes.some((prefix) => cleanZip.startsWith(prefix.substring(0, 2)))) {
        return {
          location: area.name,
          bu_prefix: area.bu_prefix,
          service_area: key as ServiceAreaKey,
        };
      }
    }

    return null;
  }, []);

  const isInServiceArea = useCallback((zipCode: string): boolean => {
    if (!zipCode) return false;

    const cleanZip = zipCode.replace(/\D/g, '').substring(0, 3);

    return Object.values(TEXAS_SERVICE_AREAS).some((area) =>
      area.zip_prefixes.some((prefix) => cleanZip.startsWith(prefix.substring(0, 2)))
    );
  }, []);

  return {
    detectTerritory,
    suggestBusinessUnit,
    isInServiceArea,
    territories,
  };
}

export default useTerritoryDetection;
```

**Update FSM hooks barrel export:**
**File:** `src/features/fsm/hooks/index.ts`

Add:
```typescript
export { useTerritoryDetection } from './useTerritoryDetection';
export { useCrewRouting } from './useCrewRouting';
```

---

### Task 11: Create useCrewRouting Hook

**File:** `src/features/fsm/hooks/useCrewRouting.ts`

```typescript
import { useState, useCallback } from 'react';
import { useDistanceMatrix } from '../../shared/hooks/useDistanceMatrix';
import type { Coordinate } from '../../shared/types/location';
import type { Job, Crew } from '../types';

interface CrewDistance {
  crew: Crew;
  distance_miles: number;
  travel_minutes: number;
}

export function useCrewRouting() {
  const { calculateMatrix, getTravelTime, isLoading: matrixLoading } = useDistanceMatrix();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findNearestCrews = useCallback(async (
    jobCoordinate: Coordinate,
    availableCrews: Crew[],
    limit: number = 5
  ): Promise<CrewDistance[]> => {
    // Filter crews that have home location set
    const crewsWithLocation = availableCrews.filter(
      (c) => c.home_latitude && c.home_longitude
    );

    if (crewsWithLocation.length === 0) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const origins = crewsWithLocation.map((c) => ({
        latitude: c.home_latitude!,
        longitude: c.home_longitude!,
        label: c.name || c.code,
      }));

      const matrix = await calculateMatrix(origins, [jobCoordinate]);

      const results: CrewDistance[] = crewsWithLocation
        .map((crew, index) => {
          const entry = matrix.find((m) => m.origin_index === index);
          return {
            crew,
            distance_miles: entry?.distance_miles || 999,
            travel_minutes: entry?.duration_minutes || 999,
          };
        })
        .sort((a, b) => a.travel_minutes - b.travel_minutes)
        .slice(0, limit);

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nearest crew search failed';
      setError(message);
      console.error('Find nearest crews error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [calculateMatrix]);

  const getJobTravelTime = useCallback(async (
    fromJob: Job | Crew,
    toJob: Job
  ): Promise<{ distance_miles: number; duration_minutes: number } | null> => {
    // Handle both Job and Crew as origin
    const fromLat = 'home_latitude' in fromJob ? fromJob.home_latitude : fromJob.site_latitude;
    const fromLng = 'home_longitude' in fromJob ? fromJob.home_longitude : fromJob.site_longitude;

    if (!fromLat || !fromLng || !toJob.site_latitude || !toJob.site_longitude) {
      return null;
    }

    return getTravelTime(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toJob.site_latitude, longitude: toJob.site_longitude }
    );
  }, [getTravelTime]);

  return {
    findNearestCrews,
    getJobTravelTime,
    getTravelTime,
    isLoading: isLoading || matrixLoading,
    error,
    clearError: () => setError(null),
  };
}

export default useCrewRouting;
```

---

### Task 12: Update PropertyEditorModal

**File:** `src/features/client_hub/components/PropertyEditorModal.tsx`

Replace existing file with this updated version that uses SmartAddressInput:

```typescript
import { useState } from 'react';
import { X, MapPin, Key, User, Phone, Mail } from 'lucide-react';
import { useCreateProperty, useUpdateProperty } from '../hooks/useProperties';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import type { AddressFormData } from '../../shared/types/location';
import {
  PROPERTY_STATUS_LABELS,
  type Property,
  type PropertyFormData,
  type PropertyStatus,
} from '../types';

interface Props {
  property: Property | null;
  communityId: string;
  onClose: () => void;
}

export default function PropertyEditorModal({ property, communityId, onClose }: Props) {
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();

  const [formData, setFormData] = useState<PropertyFormData>({
    community_id: communityId,
    lot_number: property?.lot_number || '',
    block_number: property?.block_number || '',
    address_line1: property?.address_line1 || '',
    city: property?.city || '',
    state: property?.state || 'TX',
    zip: property?.zip || '',
    gate_code: property?.gate_code || '',
    access_notes: property?.access_notes || '',
    homeowner_name: property?.homeowner_name || '',
    homeowner_phone: property?.homeowner_phone || '',
    homeowner_email: property?.homeowner_email || '',
    status: property?.status || 'available',
    notes: property?.notes || '',
    // Geocoding fields
    latitude: property?.latitude ?? null,
    longitude: property?.longitude ?? null,
  });

  const isEditing = !!property;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleAddressChange = (address: AddressFormData) => {
    setFormData((prev) => ({
      ...prev,
      address_line1: address.address_line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.address_line1.trim()) {
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: property.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Property' : 'New Property'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Lot Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Lot Information</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                <input
                  type="text"
                  value={formData.lot_number}
                  onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  placeholder="42"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                <input
                  type="text"
                  value={formData.block_number}
                  onChange={(e) => setFormData({ ...formData, block_number: e.target.value })}
                  placeholder="A"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as PropertyStatus })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address - Smart Search */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Address</h3>

            <SmartAddressInput
              value={{
                address_line1: formData.address_line1,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                latitude: formData.latitude ?? null,
                longitude: formData.longitude ?? null,
              }}
              onChange={handleAddressChange}
              label="Street Address"
              required
              restrictToTexas
              placeholder="Start typing address..."
            />
          </div>

          {/* Access Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              <Key className="w-4 h-4 inline mr-2" />
              Access Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gate Code</label>
                <input
                  type="text"
                  value={formData.gate_code}
                  onChange={(e) => setFormData({ ...formData, gate_code: e.target.value })}
                  placeholder="#1234"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Notes</label>
                <textarea
                  value={formData.access_notes}
                  onChange={(e) => setFormData({ ...formData, access_notes: e.target.value })}
                  rows={2}
                  placeholder="Enter through back gate, key under mat, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Homeowner Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              <User className="w-4 h-4 inline mr-2" />
              Homeowner Contact
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Homeowner Name</label>
                <input
                  type="text"
                  value={formData.homeowner_name}
                  onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-3 h-3 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.homeowner_phone}
                  onChange={(e) => setFormData({ ...formData, homeowner_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-3 h-3 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.homeowner_email}
                  onChange={(e) => setFormData({ ...formData, homeowner_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any additional notes about this property..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !formData.address_line1.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Property'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 13: Update useProperties Hook

**File:** `src/features/client_hub/hooks/useProperties.ts`

Ensure the create/update mutations include the new geocoding fields:

```typescript
// In useCreateProperty mutation:
const { data: result, error } = await supabase
  .from('properties')
  .insert({
    // ... existing fields ...
    latitude: data.latitude,
    longitude: data.longitude,
  })
  .select()
  .single();

// In useUpdateProperty mutation:
const { error } = await supabase
  .from('properties')
  .update({
    // ... existing fields ...
    latitude: data.latitude,
    longitude: data.longitude,
    updated_at: new Date().toISOString(),
  })
  .eq('id', id);
```

---

## FILE STRUCTURE SUMMARY

After implementation:

```
src/
├── features/
│   ├── shared/
│   │   ├── types/
│   │   │   ├── index.ts                        # NEW - barrel export
│   │   │   └── location.ts                     # NEW
│   │   ├── hooks/
│   │   │   ├── index.ts                        # NEW - barrel export
│   │   │   ├── useDebounce.ts                  # NEW
│   │   │   ├── useGeocode.ts                   # NEW
│   │   │   ├── useDistanceMatrix.ts            # NEW
│   │   │   └── useDeviceLocation.ts            # NEW - GPS capture for mobile/tablet
│   │   └── components/
│   │       ├── index.ts                        # NEW - barrel export
│   │       ├── AddressAutocomplete.tsx         # NEW
│   │       ├── SmartAddressInput.tsx           # NEW
│   │       └── CaptureLocationButton.tsx       # NEW - GPS capture button (mobile/tablet only)
│   ├── client_hub/
│   │   ├── types.ts                            # UPDATED - add lat/lng to PropertyFormData
│   │   ├── hooks/
│   │   │   └── useProperties.ts                # UPDATED - handle lat/lng
│   │   └── components/
│   │       └── PropertyEditorModal.tsx         # UPDATED - use SmartAddressInput
│   └── fsm/
│       ├── types.ts                            # UPDATED - add lat/lng to Crew, Job, RequestFormData
│       └── hooks/
│           ├── index.ts                        # UPDATED - add exports
│           ├── useTerritoryDetection.ts        # NEW
│           └── useCrewRouting.ts               # NEW
└── migrations/
    └── 178_add_geocoding_fields.sql            # NEW
```

---

## TESTING CHECKLIST

### Database & Setup
- [ ] Database migration runs successfully (`npm run migrate:apply:178_add_geocoding_fields`)
- [ ] TypeScript compiles with no errors after type updates
- [ ] Environment variable `VITE_RADAR_PUBLISHABLE_KEY` is set

### Address Autocomplete (Desktop & Mobile)
- [ ] AddressAutocomplete shows suggestions when typing Texas addresses
- [ ] Suggestions are restricted to Texas only
- [ ] Selecting an address populates city, state, zip, and coordinates
- [ ] "Location verified" indicator shows with coordinates
- [ ] Manual address entry is possible as fallback
- [ ] Coordinates are cleared when user manually edits address

### GPS Capture (Mobile/Tablet Only)
- [ ] "Capture Current Location" button appears on mobile/tablet
- [ ] "Capture Current Location" button is HIDDEN on desktop
- [ ] Clicking capture requests location permission
- [ ] Successful capture shows coordinates with accuracy
- [ ] Accuracy indicator shows correct level (Excellent/Good/Acceptable/Poor for 811)
- [ ] Error message shows if location permission denied
- [ ] Error message shows if location unavailable

### Data Persistence
- [ ] Coordinates are saved to database when creating/updating properties
- [ ] Coordinates from autocomplete selection are saved
- [ ] Coordinates from GPS capture are saved
- [ ] Territory auto-detection works from zip code (if implemented in RequestEditor)

### Regression
- [ ] No breaking changes to existing property list/detail views
- [ ] Existing properties without coordinates still display correctly

---

## IMPORTANT NOTES

1. **API Key Security**: The Radar publishable key is safe for client-side use but add domain restrictions in Radar dashboard.

2. **Rate Limits**: Radar free tier allows 100K requests/month. Debouncing (300ms) is implemented.

3. **Fallback**: Manual address entry is always available if autocomplete fails.

4. **Coordinate Persistence**: Coordinates are cleared when user manually edits address fields.

5. **Texas Restriction**: All suggestions are restricted to Texas by default.

6. **Migration Path**: Use `migrations/178_...` NOT `supabase/migrations/...`

---

## COST: Radar.io (Recommended)

| Usage | Radar.io | Google |
|-------|----------|--------|
| 1K/mo | $0 (free) | ~$25 |
| 10K/mo | ~$15 | ~$250 |
| 50K/mo | ~$75 | ~$1,240 |

**Free tier: 100,000 requests/month**
