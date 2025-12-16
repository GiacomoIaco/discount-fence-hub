import React, { useState, useRef, useEffect } from 'react';
import { Search, Building2, Home, Plus, X, ChevronRight } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useCommunities } from '../../../../features/client_hub/hooks/useCommunities';
import { usePropertySearch } from '../hooks/usePropertySearch';
import { SlideOutPanel } from './SlideOutPanel';
import { NewPropertyForm } from './NewPropertyForm';
import type { Community, Property } from '../../../../features/client_hub/types';
import type { BuilderCascadeProps } from '../types';

/**
 * BuilderCascade - Two-step selection for builder workflows
 *
 * Client (Builder) → Community → Lot/Property
 *
 * This component assumes a builder client is already selected.
 * It provides dropdown cascades for selecting Community and then Property/Lot.
 */
export function BuilderCascade({
  builderId,
  builder,
  selectedCommunity,
  selectedProperty,
  onCommunityChange,
  onPropertyChange,
  disabled = false,
  errors,
}: BuilderCascadeProps) {
  // Community dropdown state
  const [communityQuery, setCommunityQuery] = useState('');
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const [communityActiveIndex, setCommunityActiveIndex] = useState(-1);

  // Property dropdown state
  const [propertyQuery, setPropertyQuery] = useState('');
  const [isPropertyOpen, setIsPropertyOpen] = useState(false);
  const [propertyActiveIndex, setPropertyActiveIndex] = useState(-1);
  const [showNewPropertyPanel, setShowNewPropertyPanel] = useState(false);

  // Refs
  const communityInputRef = useRef<HTMLInputElement>(null);
  const communityDropdownRef = useRef<HTMLDivElement>(null);
  const propertyInputRef = useRef<HTMLInputElement>(null);
  const propertyDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch communities for this builder
  const { data: communities = [], isLoading: isLoadingCommunities } = useCommunities({
    client_id: builderId,
    search: communityQuery.length >= 2 ? communityQuery : undefined,
  });

  // Fetch properties for selected community
  const { results: properties, isLoading: isLoadingProperties } = usePropertySearch(
    propertyQuery,
    { communityId: selectedCommunity?.id }
  );

  // Filter communities locally for instant feedback
  const filteredCommunities = communityQuery.length >= 2
    ? communities
    : communities.filter(c =>
        c.name.toLowerCase().includes(communityQuery.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(communityQuery.toLowerCase()))
      );

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        communityDropdownRef.current &&
        !communityDropdownRef.current.contains(e.target as Node) &&
        communityInputRef.current &&
        !communityInputRef.current.contains(e.target as Node)
      ) {
        setIsCommunityOpen(false);
      }
      if (
        propertyDropdownRef.current &&
        !propertyDropdownRef.current.contains(e.target as Node) &&
        propertyInputRef.current &&
        !propertyInputRef.current.contains(e.target as Node)
      ) {
        setIsPropertyOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Community keyboard navigation
  const handleCommunityKeyDown = (e: React.KeyboardEvent) => {
    if (!isCommunityOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsCommunityOpen(true);
      }
      return;
    }

    const totalItems = filteredCommunities.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCommunityActiveIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCommunityActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (communityActiveIndex >= 0 && communityActiveIndex < filteredCommunities.length) {
          handleSelectCommunity(filteredCommunities[communityActiveIndex]);
        }
        break;
      case 'Escape':
        setIsCommunityOpen(false);
        setCommunityActiveIndex(-1);
        break;
    }
  };

  // Property keyboard navigation
  const handlePropertyKeyDown = (e: React.KeyboardEvent) => {
    if (!isPropertyOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsPropertyOpen(true);
      }
      return;
    }

    const totalItems = properties.length + 1; // +1 for create new

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setPropertyActiveIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setPropertyActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (propertyActiveIndex >= 0 && propertyActiveIndex < properties.length) {
          handleSelectProperty(properties[propertyActiveIndex]);
        } else if (propertyActiveIndex === properties.length) {
          setShowNewPropertyPanel(true);
          setIsPropertyOpen(false);
        }
        break;
      case 'Escape':
        setIsPropertyOpen(false);
        setPropertyActiveIndex(-1);
        break;
    }
  };

  const handleSelectCommunity = (community: Community) => {
    onCommunityChange(community);
    // Clear property when community changes
    if (selectedProperty && selectedProperty.community_id !== community.id) {
      onPropertyChange(null);
    }
    setCommunityQuery('');
    setIsCommunityOpen(false);
    setCommunityActiveIndex(-1);
    // Focus property input
    setTimeout(() => propertyInputRef.current?.focus(), 100);
  };

  const handleClearCommunity = () => {
    onCommunityChange(null);
    onPropertyChange(null);
    setCommunityQuery('');
    communityInputRef.current?.focus();
  };

  const handleSelectProperty = (property: Property) => {
    onPropertyChange(property);
    setPropertyQuery('');
    setIsPropertyOpen(false);
    setPropertyActiveIndex(-1);
  };

  const handleClearProperty = () => {
    onPropertyChange(null);
    setPropertyQuery('');
    propertyInputRef.current?.focus();
  };

  const handleNewPropertyCreated = (property: Property) => {
    onPropertyChange(property);
    setShowNewPropertyPanel(false);
  };

  return (
    <div className="space-y-4">
      {/* Community Selection */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Community
          <span className="text-red-500 ml-1">*</span>
        </label>

        {selectedCommunity ? (
          <div
            className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 border rounded-lg bg-blue-50',
              errors?.community ? 'border-red-300' : 'border-blue-200'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {selectedCommunity.name}
                </div>
                {selectedCommunity.code && (
                  <div className="text-xs text-gray-500 truncate">
                    {selectedCommunity.code}
                  </div>
                )}
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClearCommunity}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-blue-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={communityInputRef}
              type="text"
              value={communityQuery}
              onChange={(e) => {
                setCommunityQuery(e.target.value);
                setIsCommunityOpen(true);
                setCommunityActiveIndex(-1);
              }}
              onFocus={() => setIsCommunityOpen(true)}
              onKeyDown={handleCommunityKeyDown}
              placeholder="Search communities..."
              disabled={disabled}
              className={cn(
                'w-full pl-10 pr-4 py-2 border rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:bg-gray-100 disabled:cursor-not-allowed',
                errors?.community ? 'border-red-300' : 'border-gray-300'
              )}
            />
            {isLoadingCommunities && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {errors?.community && (
          <p className="mt-1 text-sm text-red-600">{errors.community}</p>
        )}

        {/* Community Dropdown */}
        {isCommunityOpen && !selectedCommunity && (
          <div
            ref={communityDropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredCommunities.length > 0 ? (
              <ul className="py-1">
                {filteredCommunities.map((community, index) => (
                  <li key={community.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectCommunity(community)}
                      className={cn(
                        'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3',
                        communityActiveIndex === index && 'bg-blue-50'
                      )}
                    >
                      <div className="p-1.5 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {community.name}
                        </div>
                        {community.code && (
                          <div className="text-sm text-gray-500 truncate">
                            {community.code}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : !isLoadingCommunities ? (
              <div className="px-3 py-4 text-center text-gray-500">
                {communityQuery.length > 0
                  ? 'No communities found'
                  : 'No communities for this builder'}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Property/Lot Selection */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Lot / Property
        </label>

        {selectedProperty ? (
          <div
            className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 border rounded-lg bg-green-50',
              errors?.property ? 'border-red-300' : 'border-green-200'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Home className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {selectedProperty.lot_number
                    ? `Lot ${selectedProperty.lot_number}`
                    : selectedProperty.address_line1}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {selectedProperty.address_line1}, {selectedProperty.city}
                </div>
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClearProperty}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-green-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={propertyInputRef}
              type="text"
              value={propertyQuery}
              onChange={(e) => {
                setPropertyQuery(e.target.value);
                setIsPropertyOpen(true);
                setPropertyActiveIndex(-1);
              }}
              onFocus={() => selectedCommunity && setIsPropertyOpen(true)}
              onKeyDown={handlePropertyKeyDown}
              placeholder={selectedCommunity ? 'Search lots or addresses...' : 'Select a community first'}
              disabled={disabled || !selectedCommunity}
              className={cn(
                'w-full pl-10 pr-4 py-2 border rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:bg-gray-100 disabled:cursor-not-allowed',
                errors?.property ? 'border-red-300' : 'border-gray-300'
              )}
            />
            {isLoadingProperties && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {!selectedCommunity && !selectedProperty && (
          <p className="mt-1 text-sm text-gray-500">Select a community first</p>
        )}

        {errors?.property && (
          <p className="mt-1 text-sm text-red-600">{errors.property}</p>
        )}

        {/* Property Dropdown */}
        {isPropertyOpen && !selectedProperty && selectedCommunity && (
          <div
            ref={propertyDropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {properties.length > 0 ? (
              <ul className="py-1">
                {properties.map((property, index) => (
                  <li key={property.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectProperty(property)}
                      className={cn(
                        'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3',
                        propertyActiveIndex === index && 'bg-blue-50'
                      )}
                    >
                      <div className="p-1.5 rounded-full bg-green-100 text-green-600 flex-shrink-0">
                        <Home className="w-4 h-4" />
                      </div>
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
                        <div className="text-sm text-gray-500 truncate">
                          {property.city}, {property.state} {property.zip}
                        </div>
                        {property.homeowner_name && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Homeowner: {property.homeowner_name}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : !isLoadingProperties && propertyQuery.length >= 2 ? (
              <div className="px-3 py-4 text-center text-gray-500">
                No lots found
              </div>
            ) : !isLoadingProperties && propertyQuery.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500">
                Type to search or create a new lot
              </div>
            ) : null}

            {/* Create new property */}
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowNewPropertyPanel(true);
                  setIsPropertyOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-3 text-left hover:bg-gray-50 flex items-center gap-3',
                  propertyActiveIndex === properties.length && 'bg-blue-50'
                )}
              >
                <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    Create New Lot
                  </div>
                  <div className="text-sm text-gray-500">
                    {propertyQuery ? `"${propertyQuery}"` : 'Add a new lot to this community'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Property Slide-Out Panel */}
      <SlideOutPanel
        isOpen={showNewPropertyPanel}
        onClose={() => setShowNewPropertyPanel(false)}
        title="Create New Lot"
        width="md"
      >
        <NewPropertyForm
          client={builder}
          communityId={selectedCommunity?.id}
          initialAddress={propertyQuery}
          onSubmit={handleNewPropertyCreated}
          onCancel={() => setShowNewPropertyPanel(false)}
        />
      </SlideOutPanel>
    </div>
  );
}
