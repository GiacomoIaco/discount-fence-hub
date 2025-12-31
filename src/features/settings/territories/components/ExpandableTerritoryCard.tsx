import { useState, useEffect } from 'react';
import { MapPin, Users, Edit2, Trash2, ChevronDown, ChevronUp, Check, Save, Palette, Clipboard, Trash } from 'lucide-react';
import type { TerritoryWithReps, TerritoryFormData, BusinessUnit, SalesRep } from '../types/territory.types';
import { TERRITORY_COLORS } from '../types/territory.types';

interface ExpandableTerritoryCardProps {
  territory: TerritoryWithReps;
  isSelected: boolean;
  isExpanded: boolean;
  salesReps: SalesRep[];
  businessUnits: BusinessUnit[];
  onSelect: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onSave: (data: TerritoryFormData) => Promise<void>;
  onDelete: () => void;
  onAssignRep: (repId: string) => void;
  onUnassignRep: (repId: string) => void;
  onZipsChange?: (zips: string[]) => void;
  externalZips?: string[]; // Zips controlled by parent (e.g., from map clicks)
  isSaving?: boolean;
}

export function ExpandableTerritoryCard({
  territory,
  isSelected,
  isExpanded,
  salesReps,
  businessUnits,
  onSelect,
  onExpand,
  onCollapse,
  onSave,
  onDelete,
  onAssignRep,
  onUnassignRep,
  onZipsChange,
  externalZips,
  isSaving = false,
}: ExpandableTerritoryCardProps) {
  const [showRepDropdown, setShowRepDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [formData, setFormData] = useState<TerritoryFormData>({
    name: territory.name,
    code: territory.code || '',
    business_unit_id: territory.business_unit_id,
    location_code: territory.location_code || null,
    disabled_qbo_class_ids: territory.disabled_qbo_class_ids || [],
    color: territory.color || TERRITORY_COLORS[0],
    description: territory.description || '',
    geometry: territory.geometry || null,
    zip_codes: territory.zip_codes || [],
  });
  const [zipInput, setZipInput] = useState((territory.zip_codes || []).join(', '));

  // Reset form when territory changes or when expanding
  useEffect(() => {
    if (isExpanded) {
      setFormData({
        name: territory.name,
        code: territory.code || '',
        business_unit_id: territory.business_unit_id,
        location_code: territory.location_code || null,
        disabled_qbo_class_ids: territory.disabled_qbo_class_ids || [],
        color: territory.color || TERRITORY_COLORS[0],
        description: territory.description || '',
        geometry: territory.geometry || null,
        zip_codes: territory.zip_codes || [],
      });
      setZipInput((territory.zip_codes || []).join(', '));
    }
  }, [isExpanded, territory]);

  // Notify parent of zip changes for live map updates
  useEffect(() => {
    if (isExpanded && onZipsChange) {
      onZipsChange(formData.zip_codes);
    }
  }, [formData.zip_codes, isExpanded, onZipsChange]);

  // Sync external zips (from map clicks) back to form
  useEffect(() => {
    if (isExpanded && externalZips && externalZips.length !== formData.zip_codes.length) {
      // Check if they actually differ (not just reordering)
      const formSet = new Set(formData.zip_codes);
      const extSet = new Set(externalZips);
      const differs = externalZips.some(z => !formSet.has(z)) ||
                      formData.zip_codes.some(z => !extSet.has(z));
      if (differs) {
        setFormData(prev => ({ ...prev, zip_codes: externalZips }));
        setZipInput(externalZips.join(', '));
      }
    }
  }, [externalZips, isExpanded]);

  const assignedRepIds = new Set(territory.assigned_reps.map(r => r.id));
  const availableReps = salesReps.filter(r => !assignedRepIds.has(r.id));

  // Handle zip code input change
  const handleZipInputChange = (value: string) => {
    setZipInput(value);
    const zips = value
      .split(/[,\s\n\t]+/)
      .map(z => z.trim())
      .filter(z => z.length === 5 && /^\d{5}$/.test(z));
    const uniqueZips = [...new Set(zips)];
    setFormData(prev => ({ ...prev, zip_codes: uniqueZips }));
  };

  // Handle zip toggle from map click
  const handleZipToggle = (zipCode: string) => {
    setFormData(prev => {
      const newZips = prev.zip_codes.includes(zipCode)
        ? prev.zip_codes.filter(z => z !== zipCode)
        : [...prev.zip_codes, zipCode];
      setZipInput(newZips.join(', '));
      return { ...prev, zip_codes: newZips };
    });
  };

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const zips = text
        .split(/[,\s\n\t]+/)
        .map(z => z.trim())
        .filter(z => z.length === 5 && /^\d{5}$/.test(z));
      const existingSet = new Set(formData.zip_codes);
      const newZips = [...formData.zip_codes];
      for (const zip of zips) {
        if (!existingSet.has(zip)) {
          newZips.push(zip);
          existingSet.add(zip);
        }
      }
      setFormData(prev => ({ ...prev, zip_codes: newZips }));
      setZipInput(newZips.join(', '));
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  // Clear all zips
  const handleClearZips = () => {
    setFormData(prev => ({ ...prev, zip_codes: [] }));
    setZipInput('');
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a territory name');
      return;
    }
    if (formData.zip_codes.length === 0) {
      alert('Please select at least one zip code');
      return;
    }
    await onSave(formData);
  };

  // Collapsed view
  if (!isExpanded) {
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
                onExpand();
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

  // Expanded (editing) view
  return (
    <div className="rounded-lg border-2 border-blue-500 bg-white shadow-lg">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between p-4 border-b bg-blue-50">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: formData.color }}
          />
          <h3 className="font-semibold text-gray-900">Editing: {territory.name}</h3>
        </div>
        <button
          onClick={onCollapse}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="Cancel editing"
        >
          <ChevronUp size={18} />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* Name & Code row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Territory name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              placeholder="TERRITORY-CODE"
            />
          </div>
        </div>

        {/* Business Unit & Color row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Business Unit
            </label>
            <select
              value={formData.business_unit_id || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                business_unit_id: e.target.value || null,
              }))}
              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select...</option>
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>
                  {bu.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-full px-2 py-1.5 text-sm border rounded flex items-center gap-2 hover:bg-gray-50"
              >
                <div
                  className="w-5 h-5 rounded"
                  style={{ backgroundColor: formData.color }}
                />
                <span className="font-mono text-xs">{formData.color}</span>
                <Palette size={14} className="ml-auto text-gray-400" />
              </button>

              {showColorPicker && (
                <div className="absolute left-0 top-full mt-1 p-2 bg-white border rounded-lg shadow-lg z-10 grid grid-cols-5 gap-1">
                  {TERRITORY_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, color }));
                        setShowColorPicker(false);
                      }}
                      className={`w-6 h-6 rounded hover:scale-110 transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zip Codes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-700">
              Zip Codes ({formData.zip_codes.length})
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                <Clipboard size={10} />
                Paste
              </button>
              {formData.zip_codes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearZips}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash size={10} />
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            value={zipInput}
            onChange={(e) => handleZipInputChange(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono"
            placeholder="78701, 78702, 78703..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Click zip codes on the map to add/remove
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Optional notes..."
          />
        </div>

        {/* Selected Zips Pills */}
        {formData.zip_codes.length > 0 && (
          <div className="max-h-20 overflow-y-auto">
            <div className="flex flex-wrap gap-1">
              {formData.zip_codes.slice(0, 20).map(zip => (
                <button
                  key={zip}
                  type="button"
                  onClick={() => handleZipToggle(zip)}
                  className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-xs font-mono hover:bg-red-100 hover:text-red-800 transition-colors"
                  title="Click to remove"
                >
                  {zip} ×
                </button>
              ))}
              {formData.zip_codes.length > 20 && (
                <span className="px-1.5 py-0.5 text-gray-500 text-xs">
                  +{formData.zip_codes.length - 20} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Save/Cancel */}
      <div className="flex gap-2 p-4 border-t bg-gray-50">
        <button
          type="button"
          onClick={onCollapse}
          className="flex-1 px-3 py-1.5 text-sm border rounded text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || formData.zip_codes.length === 0}
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default ExpandableTerritoryCard;
