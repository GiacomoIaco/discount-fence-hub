import { useState } from 'react';
import { MapPin, Users, Edit2, Trash2, ChevronDown, Check } from 'lucide-react';
import type { TerritoryWithReps, RepUser } from '../types/territory.types';

interface TerritoryCardProps {
  territory: TerritoryWithReps;
  isSelected: boolean;
  salesReps: RepUser[];
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignRep: (repId: string) => void;
  onUnassignRep: (repId: string) => void;
}

export function TerritoryCard({
  territory,
  isSelected,
  salesReps,
  onSelect,
  onEdit,
  onDelete,
  onAssignRep,
  onUnassignRep,
}: TerritoryCardProps) {
  const [showRepDropdown, setShowRepDropdown] = useState(false);

  const assignedRepIds = new Set(territory.assigned_reps.map(r => r.id));
  const availableReps = salesReps.filter(r => !assignedRepIds.has(r.id));

  return (
    <div
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: territory.color }}
          />
          <h3 className="font-semibold text-gray-900">{territory.name}</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Edit territory"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete territory "${territory.name}"?`)) {
                onDelete();
              }
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete territory"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-gray-600 mb-3">
        <div className="flex items-center gap-1">
          <MapPin size={14} />
          <span>{territory.zip_count || 0} zips</span>
        </div>
        {territory.business_unit_name && (
          <div className="text-gray-400">
            {territory.business_unit_name}
          </div>
        )}
      </div>

      {/* Assigned Reps */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-gray-400" />
          <span className="text-sm text-gray-600">Assigned:</span>
        </div>

        {territory.assigned_reps.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {territory.assigned_reps.map(rep => (
              <span
                key={rep.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs"
              >
                {rep.name}
                {rep.is_primary && (
                  <span className="text-blue-500" title="Primary">★</span>
                )}
                <button
                  onClick={() => onUnassignRep(rep.id)}
                  className="ml-1 text-gray-400 hover:text-red-500"
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic mb-2">No reps assigned</p>
        )}

        {/* Add rep dropdown */}
        {availableReps.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowRepDropdown(!showRepDropdown)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              + Assign Rep
              <ChevronDown size={12} className={showRepDropdown ? 'rotate-180' : ''} />
            </button>

            {showRepDropdown && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                {availableReps.map(rep => (
                  <button
                    key={rep.id}
                    onClick={() => {
                      onAssignRep(rep.id);
                      setShowRepDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                  >
                    {rep.name}
                    <Check size={14} className="text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TerritoryCard;
