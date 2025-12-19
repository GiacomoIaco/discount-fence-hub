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
          state: addr.stateCode || (addr.state?.length <= 2 ? addr.state : '') || 'TX',
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
