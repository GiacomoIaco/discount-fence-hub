import { useState, useEffect } from 'react';
import { X, Save, Palette } from 'lucide-react';
import type { Geometry } from 'geojson';
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
    }
  }, [initialData, isOpen]);

  // Handle shape drawn on map
  const handleShapeDrawn = (geometry: Geometry, selectedZips: string[]) => {
    setFormData(prev => ({
      ...prev,
      geometry,
      zip_codes: selectedZips,
    }));
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
      alert('Please draw a shape on the map to select zip codes');
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
          <form onSubmit={handleSubmit} className="w-80 flex flex-col border-r">
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
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Optional notes..."
                />
              </div>

              {/* Selected Zips */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Selected Zip Codes
                  </span>
                  <span className="text-sm text-blue-600 font-semibold">
                    {formData.zip_codes.length}
                  </span>
                </div>

                {formData.zip_codes.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-2">
                    <div className="flex flex-wrap gap-1">
                      {formData.zip_codes.slice(0, 20).map(zip => (
                        <span key={zip} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                          {zip}
                        </span>
                      ))}
                      {formData.zip_codes.length > 20 && (
                        <span className="px-2 py-0.5 text-gray-500 text-xs">
                          +{formData.zip_codes.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Draw a shape on the map to select zip codes
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
            <div className="p-3 bg-blue-50 border-b text-sm text-blue-700">
              Draw a circle, rectangle, or polygon on the map to select zip codes
            </div>
            <div className="flex-1">
              <TerritoryMap
                zipCentroids={zipCentroids}
                territories={[]}
                isDrawingEnabled={true}
                onShapeDrawn={handleShapeDrawn}
                highlightedZips={formData.zip_codes}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TerritoryEditor;
