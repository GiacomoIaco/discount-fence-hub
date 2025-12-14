import React, { useState, useRef, useEffect } from 'react';
import { Search, Home, Plus, X, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { usePropertySearch } from '../hooks/usePropertySearch';
import { SlideOutPanel } from './SlideOutPanel';
import { NewPropertyForm } from './NewPropertyForm';
import type { Property } from '../../../../features/client_hub/types';
import type { PropertyLookupProps } from '../types';

export function PropertyLookup({
  clientId,
  client,
  value,
  onChange,
  onPropertyCreated,
  // onDuplicateDetected - reserved for future use
  placeholder = 'Search by address, lot number, or homeowner...',
  disabled = false,
  error,
  label,
  required = false,
}: PropertyLookupProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showNewPropertyPanel, setShowNewPropertyPanel] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { results, isLoading } = usePropertySearch(query, { clientId });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const totalItems = results.length + 1; // +1 for "Create new" option

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        } else if (activeIndex === results.length) {
          setShowNewPropertyPanel(true);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleSelect = (property: Property) => {
    onChange(property);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleNewPropertyCreated = (property: Property) => {
    onChange(property);
    setShowNewPropertyPanel(false);
    onPropertyCreated?.(property);
  };

  return (
    <div className="relative">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Selected value display */}
      {value ? (
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-2 border rounded-lg bg-gray-50',
            error ? 'border-red-300' : 'border-gray-300'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Home className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {value.address_line1}
                {value.lot_number && (
                  <span className="text-gray-500 ml-2">Lot {value.lot_number}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {value.city}, {value.state} {value.zip}
              </div>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* Search input */
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || !clientId}
            className={cn(
              'w-full pl-10 pr-4 py-2 border rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:bg-gray-100 disabled:cursor-not-allowed',
              error ? 'border-red-300' : 'border-gray-300'
            )}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Hint when no client selected */}
      {!clientId && !value && (
        <p className="mt-1 text-sm text-gray-500">Select a client first to search properties</p>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !value && clientId && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {/* Results */}
          {results.length > 0 ? (
            <ul className="py-1">
              {results.map((property, index) => (
                <li key={property.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(property)}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-start gap-3',
                      activeIndex === index && 'bg-blue-50'
                    )}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 p-1.5 rounded-full bg-green-100 text-green-600 flex-shrink-0">
                      <Home className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {property.address_line1}
                        </span>
                        {property.lot_number && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            Lot {property.lot_number}
                          </span>
                        )}
                      </div>

                      {/* City/State */}
                      <div className="text-sm text-gray-500 truncate">
                        {property.city}, {property.state} {property.zip}
                      </div>

                      {/* Homeowner if available */}
                      {property.homeowner_name && (
                        <div className="text-xs text-gray-400 mt-1">
                          Homeowner: {property.homeowner_name}
                        </div>
                      )}

                      {/* Activity indicators */}
                      {(property as any).has_active_request && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          Active request exists
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          ) : !isLoading && query.length >= 2 ? (
            <div className="px-3 py-4 text-center text-gray-500">
              No properties found
            </div>
          ) : !isLoading && query.length === 0 ? (
            <div className="px-3 py-4 text-center text-gray-500">
              Type to search or create a new property
            </div>
          ) : null}

          {/* Create new option */}
          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setShowNewPropertyPanel(true);
                setIsOpen(false);
              }}
              className={cn(
                'w-full px-3 py-3 text-left hover:bg-gray-50 flex items-center gap-3',
                activeIndex === results.length && 'bg-blue-50'
              )}
            >
              <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  Create New Property
                </div>
                <div className="text-sm text-gray-500">
                  {query ? `At "${query}"` : 'Add a new property address'}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* New Property Slide-Out Panel */}
      <SlideOutPanel
        isOpen={showNewPropertyPanel}
        onClose={() => setShowNewPropertyPanel(false)}
        title="Create New Property"
        width="md"
      >
        <NewPropertyForm
          client={client}
          initialAddress={query}
          onSubmit={handleNewPropertyCreated}
          onCancel={() => setShowNewPropertyPanel(false)}
        />
      </SlideOutPanel>
    </div>
  );
}
