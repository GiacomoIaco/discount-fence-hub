import { useState, useEffect } from 'react';
import { X, Save, Loader2, Users, Wrench } from 'lucide-react';
import { useCreateCrew, useUpdateCrew, useTerritories } from '../hooks';
import type { Crew, CrewFormData, CrewType } from '../types';
import { PRODUCT_TYPES, CREW_TYPE_LABELS } from '../types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useTeamMembers } from '../../settings/hooks';

interface Props {
  crew: Crew | null;
  onClose: () => void;
}

export default function CrewEditorModal({ crew, onClose }: Props) {
  const isNew = !crew;
  const createMutation = useCreateCrew();
  const updateMutation = useUpdateCrew();

  // Load territories, business units, and team members
  const { data: territories } = useTerritories();
  const { data: teamMembers } = useTeamMembers();
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

  const [formData, setFormData] = useState<CrewFormData>({
    name: '',
    code: '',
    crew_size: 2,
    max_daily_lf: 200,
    product_skills: [],
    business_unit_id: '',
    location_code: null,
    home_territory_id: '',
    crew_type: 'standard',
    lead_user_id: '',
    is_active: true,
    // Subcontractor fields
    is_subcontractor: false,
    lead_name: '',
    lead_phone: '',
  });

  useEffect(() => {
    if (crew) {
      setFormData({
        name: crew.name,
        code: crew.code,
        crew_size: crew.crew_size,
        max_daily_lf: crew.max_daily_lf,
        product_skills: crew.product_skills,
        business_unit_id: crew.business_unit_id || '',
        location_code: crew.location_code || null,
        home_territory_id: crew.home_territory_id || '',
        crew_type: crew.crew_type || 'standard',
        lead_user_id: crew.lead_user_id || '',
        is_active: crew.is_active,
        // Subcontractor fields
        is_subcontractor: crew.is_subcontractor || false,
        lead_name: crew.lead_name || '',
        lead_phone: crew.lead_phone || '',
      });
    }
  }, [crew]);

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      product_skills: prev.product_skills.includes(skill)
        ? prev.product_skills.filter((s) => s !== skill)
        : [...prev.product_skills, skill],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation based on mode
    if (formData.is_subcontractor) {
      // Subcontractor: Name + Phone required
      if (!formData.name.trim() || !formData.lead_phone.trim()) {
        return;
      }
    } else {
      // Internal crew: Name + Code required
      if (!formData.name.trim() || !formData.code.trim()) {
        return;
      }
    }

    // Auto-generate code for subs if empty
    const dataToSubmit = { ...formData };
    if (formData.is_subcontractor && !formData.code.trim()) {
      dataToSubmit.code = formData.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 6)
        .toUpperCase();
    }

    if (isNew) {
      await createMutation.mutateAsync(dataToSubmit);
    } else {
      await updateMutation.mutateAsync({ id: crew.id, data: dataToSubmit });
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
            {isNew ? 'New Crew / Subcontractor' : 'Edit Crew'}
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
          {/* Crew Type Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_subcontractor: false })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !formData.is_subcontractor
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Internal Crew
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_subcontractor: true })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                formData.is_subcontractor
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Subcontractor
            </button>
          </div>

          {formData.is_subcontractor ? (
            /* ========== SUBCONTRACTOR MODE ========== */
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                Subcontractors are external crews. Only name and phone are required.
              </div>

              {/* Name & Phone (required) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crew/Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., ABC Fence Co"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.lead_phone}
                    onChange={(e) => setFormData({ ...formData, lead_phone: e.target.value })}
                    placeholder="(512) 555-1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>

              {/* Lead Name & Code (optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.lead_name}
                    onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
                    placeholder="e.g., Roberto Garcia"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Auto-generated"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 uppercase font-mono"
                  />
                  <p className="mt-1 text-xs text-gray-500">For import/export</p>
                </div>
              </div>

              {/* Optional: BU & Territory */}
              <div className="grid grid-cols-2 gap-4">
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
                        {bu.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Territory
                  </label>
                  <select
                    value={formData.home_territory_id}
                    onChange={(e) => setFormData({ ...formData, home_territory_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">-- Select --</option>
                    {territories?.filter(t => t.is_active).map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territory.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Skills
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TYPES.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleSkillToggle(skill)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        formData.product_skills.includes(skill)
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ========== INTERNAL CREW MODE ========== */
            <>
              {/* Name & Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Crew Alpha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., CRW-A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 uppercase font-mono"
                    required
                  />
                </div>
              </div>

              {/* Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crew Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.crew_size}
                    onChange={(e) => setFormData({ ...formData, crew_size: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Daily LF
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="25"
                    value={formData.max_daily_lf}
                    onChange={(e) => setFormData({ ...formData, max_daily_lf: parseInt(e.target.value) || 200 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Linear feet capacity per day</p>
                </div>
              </div>

              {/* Business Unit & Territory */}
              <div className="grid grid-cols-2 gap-4">
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
                        {bu.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Territory
                  </label>
                  <select
                    value={formData.home_territory_id}
                    onChange={(e) => setFormData({ ...formData, home_territory_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">-- Select --</option>
                    {territories?.filter(t => t.is_active).map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territory.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Crew Type & Lead */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crew Type
                  </label>
                  <select
                    value={formData.crew_type}
                    onChange={(e) => setFormData({ ...formData, crew_type: e.target.value as CrewType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {(Object.keys(CREW_TYPE_LABELS) as CrewType[]).map((type) => (
                      <option key={type} value={type}>
                        {CREW_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Internal = in-house, Small Jobs = quick turnaround
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crew Lead
                  </label>
                  <select
                    value={formData.lead_user_id}
                    onChange={(e) => setFormData({ ...formData, lead_user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">-- No Lead --</option>
                    {teamMembers?.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.full_name || member.email}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Point of contact for this crew
                  </p>
                </div>
              </div>

              {/* Product Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Skills
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TYPES.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleSkillToggle(skill)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        formData.product_skills.includes(skill)
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Active (both modes) */}
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
