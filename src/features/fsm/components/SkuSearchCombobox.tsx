/**
 * SKU Search Combobox for Quote Line Items (O-036)
 *
 * Type-ahead search with recent items at top.
 * Auto-populates pricing when SKU is selected.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Clock, Package, X, ChevronDown } from 'lucide-react';
import { useSkuSearchWithRecents, type SkuSearchResult } from '../hooks/useSkuSearch';

interface SkuSearchComboboxProps {
  value: SkuSearchResult | null;
  onChange: (sku: SkuSearchResult | null) => void;
  productTypeCode?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SkuSearchCombobox({
  value,
  onChange,
  productTypeCode,
  placeholder = 'Search SKU or description...',
  disabled = false,
  className = '',
}: SkuSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    searchQuery,
    setSearchQuery,
    results,
    isLoading,
    trackRecentSku,
    hasRecents,
  } = useSkuSearchWithRecents({ productTypeCode });

  // Sync input value with search query
  useEffect(() => {
    setSearchQuery(inputValue);
  }, [inputValue, setSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((sku: SkuSearchResult) => {
    onChange(sku);
    trackRecentSku(sku.id);
    setInputValue('');
    setIsOpen(false);
  }, [onChange, trackRecentSku]);

  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Show selected SKU or input field
  if (value && !isOpen) {
    return (
      <div
        ref={containerRef}
        className={`relative ${className}`}
      >
        <div
          className={`
            flex items-center gap-2 px-3 py-2 border rounded-lg bg-white
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-400'}
          `}
          onClick={() => !disabled && setIsOpen(true)}
        >
          <Package className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {value.sku_code}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {value.sku_name}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pl-10 pr-10 py-2 border rounded-lg text-sm
            focus:ring-2 focus:ring-purple-500 focus:border-purple-500
            disabled:bg-gray-50 disabled:cursor-not-allowed
          `}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {/* Recent items header */}
          {!searchQuery && hasRecents && results.length > 0 && (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Recent
            </div>
          )}

          {/* Search results header */}
          {searchQuery && results.length > 0 && (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b flex items-center gap-1">
              <Search className="w-3 h-3" />
              Results for "{searchQuery}"
            </div>
          )}

          {/* Results list */}
          {results.length > 0 ? (
            <ul className="py-1">
              {results.map((sku) => (
                <li key={sku.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(sku)}
                    className="w-full px-3 py-2 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none"
                  >
                    <div className="flex items-start gap-3">
                      <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">
                            {sku.sku_code}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {sku.product_type_code}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {sku.sku_name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {sku.height}" {sku.post_type} • {sku.product_style_name}
                        </div>
                      </div>
                      {sku.standard_cost_per_foot !== null && (
                        <div className="text-xs text-gray-500 flex-shrink-0">
                          ${sku.standard_cost_per_foot.toFixed(2)}/LF
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : searchQuery ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No SKUs found for "{searchQuery}"</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Start typing to search SKUs</p>
              <p className="text-xs mt-1">Search by SKU code or description</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
