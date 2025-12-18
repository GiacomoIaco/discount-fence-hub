import { useState, useEffect, useMemo } from 'react';
import { X, Save, Palette, Clipboard, Trash2 } from 'lucide-react';
import type { TerritoryFormData, BusinessUnit, MetroZipCentroid } from '../types/territory.types';
import { TERRITORY_COLORS } from '../types/territory.types';
import { TerritoryMap } from './TerritoryMap';

interface TerritoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TerritoryFormData) => void;
  initialData?: Partial<TerritoryFormData> & { id?: string };
  businessUnits: BusinessUnit[];
  zipCentroids: MetroZipCentroid[];
  isLoading?: boolean;
}

export function TerritoryEditor({
  isOpen,
  onClose,
  onSave,
  initialData,
  businessUnits,
  zipCentroids,
  isLoading = false,
}: TerritoryEditorProps) {
  const [formData, setFormData] = useState<TerritoryFormData>({
    name: '',
    code: '',
    business_unit_id: null,
    color: TERRITORY_COLORS[0],
    description: '',
    geometry: null,
    zip_codes: [],
  });

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [zipInput, setZipInput] = useState('');

  // Valid zip codes set for quick lookup
  const validZipSet = useMemo(() => {
    return new Set(zipCentroids.map(z => z.zip_code));
  }, [zipCentroids]);

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        code: initialData.code || '',
        business_unit_id: initialData.business_unit_id || null,
        color: initialData.color || TERRITORY_COLORS[0],
        description: initialData.description || '',
        geometry: initialData.geometry || null,
        zip_codes: initialData.zip_codes || [],
      });
      // Populate zip input with existing zips
      setZipInput((initialData.zip_codes || []).join(', '));
    } else {
      // Reset form for new territory
      setFormData({
        name: '',
        code: '',
        business_unit_id: null,
        color: TERRITORY_COLORS[Math.floor(Math.random() * TERRITORY_COLORS.length)],
        description: '',
        geometry: null,
        zip_codes: [],
      });
      setZipInput('');
    }
  }, [initialData, isOpen]);

  // Handle zip code click on map (toggle)
  const handleZipClick = (zipCode: string) => {
    setFormData(prev => {
      const newZips = prev.zip_codes.includes(zipCode)
        ? prev.zip_codes.filter(z => z !== zipCode)
        : [...prev.zip_codes, zipCode];

      // Update input field too
      setZipInput(newZips.join(', '));

      return { ...prev, zip_codes: newZips };
    });
  };

  // Parse and add zip codes from input
  const parseAndAddZips = (input: string) => {
    // Split by comma, space, newline, or tab
    const zips = input
      .split(/[,\s\n\t]+/)
      .map(z => z.trim())
      .filter(z => z.length === 5 && /^\d{5}$/.test(z)); // Only valid 5-digit zips

    // Filter to only valid zips in our system
    const validZips = zips.filter(z => validZipSet.has(z));

    // Merge with existing (avoid duplicates)
    const existingSet = new Set(formData.zip_codes);
    const newZips = [...formData.zip_codes];

    for (const zip of validZips) {
      if (!existingSet.has(zip)) {
        newZips.push(zip);
        existingSet.add(zip);
      }
    }

    setFormData(prev => ({ ...prev, zip_codes: newZips }));
    setZipInput(newZips.join(', '));

    // Return count of added vs invalid for feedback
    return {
      added: validZips.length,
      invalid: zips.length - validZips.length,
    };
  };

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const result = parseAndAddZips(text);
      if (result.invalid > 0) {
        alert(`Added ${result.added} zip codes. ${result.invalid} were invalid or not in our coverage area.`);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('Unable to access clipboard. Please paste directly into the text field.');
    }
  };

  // Handle input field change
  const handleZipInputChange = (value: string) => {
    setZipInput(value);

    // Parse zips from input
    const zips = value
      .split(/[,\s\n\t]+/)
      .map(z => z.trim())
      .filter(z => z.length === 5 && /^\d{5}$/.test(z) && validZipSet.has(z));

    // Remove duplicates
    const uniqueZips = [...new Set(zips)];

    setFormData(prev => ({ ...prev, zip_codes: uniqueZips }));
  };

  // Clear all selected zips
  const handleClearZips = () => {
    setFormData(prev => ({ ...prev, zip_codes: [] }));
    setZipInput('');
  };

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a territory name');
      return;
    }

    if (formData.zip_codes.length === 0) {
      alert('Please select at least one zip code');
      return;
    }

    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData?.id ? 'Edit Territory' : 'New Territory'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Form */}
          <form onSubmit={handleSubmit} className="w-96 flex flex-col border-r">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Territory Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name,
                      code: prev.code || generateCode(name),
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., North Austin"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="NORTH-AUSTIN"
                />
              </div>

              {/* Business Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Unit
                </label>
                <select
                  value={formData.business_unit_id || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    business_unit_id: e.target.value || null,
                  }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select...</option>
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-full px-3 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50"
                  >
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: formData.color }}
                    />
                    <span className="font-mono text-sm">{formData.color}</span>
                    <Palette size={16} className="ml-auto text-gray-400" />
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
                          className={`w-8 h-8 rounded hover:scale-110 transition-transform ${
                            formData.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Optional notes..."
                />
              </div>

              {/* Zip Codes Input */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Zip Codes
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                      title="Paste from clipboard"
                    >
                      <Clipboard size={12} />
                      Paste
                    </button>
                    {formData.zip_codes.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearZips}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        title="Clear all"
                      >
                        <Trash2 size={12} />
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={zipInput}
                  onChange={(e) => handleZipInputChange(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                  placeholder="Enter zip codes separated by commas, spaces, or new lines...&#10;e.g., 78701, 78702, 78703"
                />

                <p className="text-xs text-gray-500 mt-1">
                  Or click zip codes directly on the map
                </p>
              </div>

              {/* Selected Zips Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Selected Zip Codes
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {formData.zip_codes.length}
                  </span>
                </div>

                {formData.zip_codes.length > 0 ? (
                  <div className="max-h-24 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {formData.zip_codes.slice(0, 30).map(zip => (
                        <button
                          key={zip}
                          type="button"
                          onClick={() => handleZipClick(zip)}
                          className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-mono hover:bg-red-100 hover:text-red-800 transition-colors"
                          title="Click to remove"
                        >
                          {zip} ×
                        </button>
                      ))}
                      {formData.zip_codes.length > 30 && (
                        <span className="px-2 py-0.5 text-gray-500 text-xs">
                          +{formData.zip_codes.length - 30} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No zip codes selected
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || formData.zip_codes.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {isLoading ? 'Saving...' : 'Save Territory'}
              </button>
            </div>
          </form>

          {/* Right: Map */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 bg-green-50 border-b text-sm text-green-700">
              Click zip codes on the map to select/deselect, or paste a list in the field on the left
            </div>
            <div className="flex-1">
              <TerritoryMap
                zipCentroids={zipCentroids}
                territories={[]}
                isSelectionEnabled={true}
                selectedZips={formData.zip_codes}
                onZipClick={handleZipClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TerritoryEditor;
