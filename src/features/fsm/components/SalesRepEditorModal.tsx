import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useCreateSalesRep, useUpdateSalesRep, useTerritories } from '../hooks';
import type { SalesRep, SalesRepFormData } from '../types';
import { PRODUCT_TYPES } from '../types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface Props {
  salesRep: SalesRep | null;
  onClose: () => void;
}

export default function SalesRepEditorModal({ salesRep, onClose }: Props) {
  const isNew = !salesRep;
  const createMutation = useCreateSalesRep();
  const updateMutation = useUpdateSalesRep();

  // Load territories and users
  const { data: territories } = useTerritories();
  const { data: users } = useQuery({
    queryKey: ['user_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState<SalesRepFormData>({
    name: '',
    email: '',
    phone: '',
    user_id: '',
    territory_ids: [],
    product_skills: [],
    max_daily_assessments: 4,
    is_active: true,
  });

  useEffect(() => {
    if (salesRep) {
      setFormData({
        name: salesRep.name,
        email: salesRep.email || '',
        phone: salesRep.phone || '',
        user_id: salesRep.user_id || '',
        territory_ids: salesRep.territory_ids,
        product_skills: salesRep.product_skills,
        max_daily_assessments: salesRep.max_daily_assessments,
        is_active: salesRep.is_active,
      });
    }
  }, [salesRep]);

  const handleTerritoryToggle = (territoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      territory_ids: prev.territory_ids.includes(territoryId)
        ? prev.territory_ids.filter((id) => id !== territoryId)
        : [...prev.territory_ids, territoryId],
    }));
  };

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      product_skills: prev.product_skills.includes(skill)
        ? prev.product_skills.filter((s) => s !== skill)
        : [...prev.product_skills, skill],
    }));
  };

  const handleUserSelect = (userId: string) => {
    const selectedUser = users?.find((u) => u.id === userId);
    setFormData((prev) => ({
      ...prev,
      user_id: userId,
      email: selectedUser?.email || prev.email,
      name: prev.name || selectedUser?.full_name || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    if (isNew) {
      await createMutation.mutateAsync(formData);
    } else {
      await updateMutation.mutateAsync({ id: salesRep.id, data: formData });
    }

    onClose();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {isNew ? 'New Sales Rep' : 'Edit Sales Rep'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Link to User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to App User
            </label>
            <select
              value={formData.user_id}
              onChange={(e) => handleUserSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">-- None (external rep) --</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Optional: Link to a user account for app access
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., John Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="512-555-1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Max Daily Assessments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Daily Assessments
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={formData.max_daily_assessments}
              onChange={(e) => setFormData({ ...formData, max_daily_assessments: parseInt(e.target.value) || 4 })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Territories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Territories
            </label>
            {territories && territories.filter(t => t.is_active).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {territories.filter(t => t.is_active).map((territory) => (
                  <button
                    key={territory.id}
                    type="button"
                    onClick={() => handleTerritoryToggle(territory.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      formData.territory_ids.includes(territory.id)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {territory.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No territories defined. Create territories first.
              </p>
            )}
          </div>

          {/* Product Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Expertise
            </label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSkillToggle(skill)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    formData.product_skills.includes(skill)
                      ? 'bg-purple-100 border-purple-300 text-purple-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
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
