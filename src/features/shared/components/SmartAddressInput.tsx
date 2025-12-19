import { useState } from 'react';
import { Check, Edit2, AlertTriangle, MapPin } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { CaptureLocationButton } from './CaptureLocationButton';
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
  // isEditingDetails: true when user wants to manually edit city/state/zip
  const [isEditingDetails, setIsEditingDetails] = useState(showManualFields);

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    onChange({
      address_line1: suggestion.address_line1,
      address_line2: value.address_line2 || '', // Preserve any unit/suite entered
      city: suggestion.city,
      state: suggestion.state,
      zip: suggestion.zip,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setIsEditingDetails(false);
  };

  const handleManualChange = (field: keyof AddressFormData, newValue: string) => {
    onChange({
      ...value,
      [field]: newValue,
      // Clear coordinates when user manually edits location fields
      ...(field !== 'address_line2' ? { latitude: null, longitude: null } : {}),
    });
  };

  const handleInputChange = (newValue: string) => {
    onChange({
      ...value,
      address_line1: newValue,
      // Clear coordinates when typing (user is searching)
      latitude: null,
      longitude: null,
    });
  };

  // Handler for "Use as typed" - when user wants to force an unrecognized address
  const handleUseAsTyped = (typedAddress: string) => {
    onChange({
      ...value,
      address_line1: typedAddress,
      latitude: null,
      longitude: null,
    });
    setIsEditingDetails(true); // Show manual fields so user can fill city/state/zip
  };

  const handleGpsCapture = (coords: { latitude: number; longitude: number; accuracy: number }) => {
    onChange({
      ...value,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  };

  const hasCoords = hasValidCoordinates(value.latitude, value.longitude);
  const hasLocationDetails = value.city || value.state || value.zip;

  return (
    <div className="space-y-3">
      {/* Address autocomplete with "Use as typed" support */}
      <AddressAutocomplete
        value={value.address_line1}
        onChange={handleInputChange}
        onAddressSelect={handleAddressSelect}
        onUseAsTyped={handleUseAsTyped}
        label={label}
        required={required}
        restrictToTexas={restrictToTexas}
        disabled={disabled}
        error={error}
        placeholder={placeholder}
      />

      {/* Unit/Suite - ALWAYS visible */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Apt / Suite / Unit
        </label>
        <input
          type="text"
          value={value.address_line2 || ''}
          onChange={(e) => handleManualChange('address_line2', e.target.value)}
          placeholder="Apt 101, Suite 200, etc."
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      {/* Location verified indicator */}
      {hasCoords && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600">
            <Check className="w-3 h-3" />
            <span>Location verified</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <MapPin className="w-3 h-3" />
            <span>{formatCoordinates(value.latitude!, value.longitude!, 4)}</span>
          </div>
        </div>
      )}

      {/* City/State/ZIP Summary (collapsed view) - shown when verified and not editing */}
      {!isEditingDetails && hasLocationDetails && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
          <span className="text-gray-600">
            {[value.city, value.state, value.zip].filter(Boolean).join(', ')}
          </span>
          <button
            type="button"
            onClick={() => setIsEditingDetails(true)}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            disabled={disabled}
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      )}

      {/* City/State/ZIP editable fields - shown when editing OR when empty (no location details) */}
      {(isEditingDetails || !hasLocationDetails) && (
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-3">
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
                onChange={(e) => handleManualChange('state', e.target.value.toUpperCase())}
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

          {/* Done button to collapse back to summary */}
          {hasLocationDetails && (
            <button
              type="button"
              onClick={() => setIsEditingDetails(false)}
              className="text-sm text-blue-600 hover:text-blue-700"
              disabled={disabled}
            >
              Done editing
            </button>
          )}
        </div>
      )}

      {/* Warning for manual entry without coordinates */}
      {!hasCoords && value.address_line1 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-amber-800">
            <strong>Unverified address:</strong> This address doesn't have GPS coordinates.
            Select an address from the dropdown for accurate location tracking.
          </div>
        </div>
      )}

      {/* GPS Capture - Mobile/Tablet only */}
      <CaptureLocationButton
        onCapture={handleGpsCapture}
        currentLatitude={value.latitude}
        currentLongitude={value.longitude}
        disabled={disabled}
      />
    </div>
  );
}

export default SmartAddressInput;
