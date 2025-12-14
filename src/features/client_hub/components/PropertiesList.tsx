import { useState } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Home,
  Phone,
  Key,
  User,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { useProperties } from '../hooks/useProperties';
import { PROPERTY_STATUS_LABELS, type PropertyStatus, type Property } from '../types';

interface Props {
  communityId: string;
  onAddProperty: () => void;
  onSelectProperty: (property: Property) => void;
  /** Navigate to property detail page to see all jobs/quotes/requests */
  onViewProperty?: (property: Property) => void;
}

export default function PropertiesList({ communityId, onAddProperty, onSelectProperty, onViewProperty }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | ''>('');

  const { data: properties, isLoading } = useProperties(communityId, {
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const statusCounts = properties?.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700">
            Properties ({properties?.length || 0})
          </h3>
        </div>
        <button
          onClick={onAddProperty}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by address, lot, or homeowner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PropertyStatus | '')}
            className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            <option value="">All Statuses</option>
            {Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({statusCounts[value] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Properties List */}
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading properties...</p>
        </div>
      ) : !properties || properties.length === 0 ? (
        <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {search || statusFilter
              ? 'No properties match your filters'
              : 'No properties added yet'}
          </p>
          {!search && !statusFilter && (
            <button
              onClick={onAddProperty}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              Add your first property
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onEdit={() => onSelectProperty(property)}
              onView={onViewProperty ? () => onViewProperty(property) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({
  property,
  onEdit,
  onView
}: {
  property: Property;
  onEdit: () => void;
  onView?: () => void;
}) {
  const statusColors: Record<PropertyStatus, string> = {
    available: 'bg-green-100 text-green-700',
    sold: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg">
            <Home className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {property.lot_number && (
                <span className="text-xs font-medium text-gray-500">
                  Lot {property.lot_number}
                  {property.block_number && `, Block ${property.block_number}`}
                </span>
              )}
            </div>
            <div className="font-medium text-gray-900">{property.address_line1}</div>
            {(property.city || property.zip) && (
              <div className="text-sm text-gray-500">
                {property.city}{property.city && property.state ? ', ' : ''}{property.state} {property.zip}
              </div>
            )}

            {/* Quick Info */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {property.homeowner_name && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {property.homeowner_name}
                </span>
              )}
              {property.homeowner_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {property.homeowner_phone}
                </span>
              )}
              {property.gate_code && (
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  {property.gate_code}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[property.status]}`}>
            {PROPERTY_STATUS_LABELS[property.status]}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
              title="Edit property"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {onView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                title="View all jobs & quotes"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
