import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useCreateTerritory, useUpdateTerritory } from '../hooks';
import type { Territory, TerritoryFormData } from '../types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface Props {
  territory: Territory | null;
  onClose: () => void;
}

export default function TerritoryEditorModal({ territory, onClose }: Props) {
  const isNew = !territory;
  const createMutation = useCreateTerritory();
  const updateMutation = useUpdateTerritory();

  // Load business units
  const { data: businessUnits } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, name, code')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState<TerritoryFormData>({
    name: '',
    code: '',
    zip_codes: '',
    business_unit_id: '',
    location_code: '',
    disabled_qbo_class_ids: [],
    is_active: true,
  });

  useEffect(() => {
    if (territory) {
      setFormData({
        name: territory.name,
        code: territory.code,
        zip_codes: territory.zip_codes.join(', '),
        business_unit_id: territory.business_unit_id || '',
        location_code: territory.location_code || '',
        disabled_qbo_class_ids: territory.disabled_qbo_class_ids || [],
        is_active: territory.is_active,
      });
    }
  }, [territory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      return;
    }

    if (isNew) {
      await createMutation.mutateAsync(formData);
    } else {
      await updateMutation.mutateAsync({ id: territory.id, data: formData });
    }

    onClose();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {isNew ? 'New Territory' : 'Edit Territory'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., North Austin"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., ATX-N"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 uppercase font-mono"
              required
            />
          </div>

          {/* Business Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Unit
            </label>
            <select
              value={formData.business_unit_id}
              onChange={(e) => setFormData({ ...formData, business_unit_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">-- Select --</option>
              {businessUnits?.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.name} ({bu.code})
                </option>
              ))}
            </select>
          </div>

          {/* Zip Codes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zip Codes
            </label>
            <input
              type="text"
              value={formData.zip_codes}
              onChange={(e) => setFormData({ ...formData, zip_codes: e.target.value })}
              placeholder="78701, 78702, 78703"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated list of zip codes in this territory
            </p>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active (available for assignment)
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 font-medium transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isNew ? 'Create' : 'Save'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
