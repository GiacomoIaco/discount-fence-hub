import { useState } from 'react';
import {
  Plus,
  MapPin,
  Edit2,
  DollarSign,
} from 'lucide-react';
import { useGeographies, useCreateGeography, useUpdateGeography } from '../hooks/useClients';
import type { Geography } from '../types';

export default function GeographiesList() {
  const { data: geographies, isLoading } = useGeographies();
  const createMutation = useCreateGeography();
  const updateMutation = useUpdateGeography();

  const [showEditor, setShowEditor] = useState(false);
  const [editingGeo, setEditingGeo] = useState<Geography | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    state: 'TX',
    base_labor_rate: 45,
    labor_rate_multiplier: 1.0,
  });

  const handleEdit = (geo: Geography) => {
    setEditingGeo(geo);
    setFormData({
      code: geo.code,
      name: geo.name,
      state: geo.state,
      base_labor_rate: geo.base_labor_rate || 45,
      labor_rate_multiplier: geo.labor_rate_multiplier,
    });
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingGeo(null);
    setFormData({
      code: '',
      name: '',
      state: 'TX',
      base_labor_rate: 45,
      labor_rate_multiplier: 1.0,
    });
    setShowEditor(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim() || !formData.name.trim()) {
      return;
    }

    try {
      if (editingGeo) {
        await updateMutation.mutateAsync({
          id: editingGeo.id,
          data: {
            code: formData.code,
            name: formData.name,
            state: formData.state,
            base_labor_rate: formData.base_labor_rate,
            labor_rate_multiplier: formData.labor_rate_multiplier,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: formData.code,
          name: formData.name,
          state: formData.state,
          base_labor_rate: formData.base_labor_rate,
          labor_rate_multiplier: formData.labor_rate_multiplier,
          is_active: true,
        } as any);
      }
      setShowEditor(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Geographies</h2>
          <p className="text-sm text-gray-500">Labor rate zones for different regions</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Geography
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : geographies?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No geographies yet</h3>
          <p className="text-gray-500 mt-1">Create your first geography to define labor zones</p>
          <button
            onClick={handleCreate}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Geography
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {geographies?.map((geo) => (
            <div
              key={geo.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{geo.name}</h3>
                    <p className="text-sm text-gray-500">{geo.code} • {geo.state}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(geo)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Base Labor Rate</div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-lg font-semibold text-gray-900">
                      {geo.base_labor_rate?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-sm text-gray-500">/hr</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Multiplier</div>
                  <span className={`inline-block px-2 py-1 text-sm font-medium rounded ${
                    geo.labor_rate_multiplier > 1
                      ? 'bg-orange-100 text-orange-700'
                      : geo.labor_rate_multiplier < 1
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {geo.labor_rate_multiplier.toFixed(3)}x
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingGeo ? 'Edit Geography' : 'New Geography'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="AUS"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Austin"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Labor Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    value={formData.base_labor_rate}
                    onChange={(e) => setFormData({ ...formData, base_labor_rate: parseFloat(e.target.value) || 0 })}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Multiplier
                  </label>
                  <input
                    type="number"
                    value={formData.labor_rate_multiplier}
                    onChange={(e) => setFormData({ ...formData, labor_rate_multiplier: parseFloat(e.target.value) || 1 })}
                    min={0}
                    step={0.001}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    1.0 = standard rate, {"<"}1.0 = cheaper, {">"}1.0 = more expensive
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !formData.code.trim() || !formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Saving...' : editingGeo ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
