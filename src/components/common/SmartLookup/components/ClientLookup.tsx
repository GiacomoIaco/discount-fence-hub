import React, { useState, useRef, useEffect } from 'react';
import { Search, User, Building2, Phone, Mail, MapPin, ChevronRight, Plus, X, Users } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useClientSearch } from '../hooks/useClientSearch';
import { SlideOutPanel } from './SlideOutPanel';
import { NewClientForm } from './NewClientForm';
import type { ClientLookupProps, ClientSearchResult, SelectedEntity } from '../types';

export function ClientLookup({
  value,
  onChange,
  businessUnit,
  onClientCreated,
  // onCommunityCreated - reserved for future use
  placeholder = 'Search by name, phone, or email...',
  disabled = false,
  error,
  label,
  required = false,
}: ClientLookupProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showNewClientPanel, setShowNewClientPanel] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { results, isLoading } = useClientSearch(query, { businessUnit });

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
          // "Create new" option
          setShowNewClientPanel(true);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleSelect = (result: ClientSearchResult) => {
    const entity: SelectedEntity = {
      client: result.client_data!,
      community: result.entity_type === 'community' ? result.community_data : null,
      display_name: result.entity_type === 'community'
        ? `${result.name} (${result.parent_name})`
        : result.name,
    };

    onChange(entity);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleNewClientCreated = (client: any) => {
    const entity: SelectedEntity = {
      client,
      community: null,
      display_name: client.name,
    };
    onChange(entity);
    setShowNewClientPanel(false);
    onClientCreated?.(client);
  };

  // Match indicator icon based on match field
  const getMatchIcon = (matchField: string) => {
    switch (matchField) {
      case 'phone':
        return <Phone className="w-3 h-3" />;
      case 'email':
        return <Mail className="w-3 h-3" />;
      default:
        return null;
    }
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
            {value.community ? (
              <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            ) : (
              <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {value.display_name}
              </div>
              {value.client.primary_contact_phone && (
                <div className="text-xs text-gray-500 truncate">
                  {value.client.primary_contact_phone}
                </div>
              )}
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
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
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

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !value && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {/* Results */}
          {results.length > 0 ? (
            <ul className="py-1">
              {results.map((result, index) => (
                <li key={`${result.entity_type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-start gap-3',
                      activeIndex === index && 'bg-blue-50'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      'mt-0.5 p-1.5 rounded-full flex-shrink-0',
                      result.entity_type === 'community'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      {result.entity_type === 'community' ? (
                        <Building2 className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {result.display_name}
                        </span>
                        {/* Match indicator */}
                        {result.match_field !== 'name' && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {getMatchIcon(result.match_field)}
                            <span className="capitalize">{result.match_field}</span>
                          </span>
                        )}
                      </div>

                      {/* Subtitle (community parent or client type) */}
                      <div className="text-sm text-gray-500 truncate">
                        {result.subtitle}
                      </div>

                      {/* Contact info preview */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {result.primary_contact_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {result.primary_contact_phone}
                          </span>
                        )}
                        {result.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {result.city}, {result.state}
                          </span>
                        )}
                        {result.entity_type === 'client' && result.communities_count !== undefined && result.communities_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {result.communities_count} communities
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="px-3 py-4 text-center text-gray-500">
              No matching clients or communities found
            </div>
          ) : null}

          {/* Create new option */}
          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setShowNewClientPanel(true);
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
                  Create New Client
                </div>
                <div className="text-sm text-gray-500">
                  {query ? `"${query}"` : 'Add a new client to the system'}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* New Client Slide-Out Panel */}
      <SlideOutPanel
        isOpen={showNewClientPanel}
        onClose={() => setShowNewClientPanel(false)}
        title="Create New Client"
        width="md"
      >
        <NewClientForm
          initialName={query}
          onSubmit={handleNewClientCreated}
          onCancel={() => setShowNewClientPanel(false)}
        />
      </SlideOutPanel>
    </div>
  );
}
