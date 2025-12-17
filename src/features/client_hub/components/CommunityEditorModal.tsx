import { useState } from 'react';
import { X, FileSpreadsheet, BookOpen, Calendar, User, Truck } from 'lucide-react';
import { useCreateCommunity, useUpdateCommunity } from '../hooks/useCommunities';
import { useClients, useGeographies, useUserProfiles } from '../hooks/useClients';
import { useRateSheets } from '../hooks/useRateSheets';
import { useQboClasses } from '../hooks/useQboClasses';
import { useCrews } from '../../fsm/hooks';
import type { Community, CommunityFormData, CommunityStatus } from '../types';
import { COMMUNITY_STATUS_LABELS } from '../types';

interface Props {
  community: Community | null;
  onClose: () => void;
  defaultClientId?: string;
}

export default function CommunityEditorModal({ community, onClose, defaultClientId }: Props) {
  const createMutation = useCreateCommunity();
  const updateMutation = useUpdateCommunity();

  const { data: clients } = useClients({});
  const { data: geographies } = useGeographies();
  const { data: rateSheets } = useRateSheets({ is_active: true });
  const { data: qboClasses } = useQboClasses(true); // Only selectable classes
  const { data: userProfiles } = useUserProfiles();
  const { data: crews } = useCrews();

  const [formData, setFormData] = useState<CommunityFormData>({
    client_id: community?.client_id || defaultClientId || '',
    geography_id: community?.geography_id || '',
    name: community?.name || '',
    code: community?.code || '',
    address_line1: community?.address_line1 || '',
    city: community?.city || '',
    state: community?.state || 'TX',
    zip: community?.zip || '',
    rate_sheet_id: community?.rate_sheet_id || null,
    override_qbo_class_id: community?.override_qbo_class_id || null,
    restrict_skus: community?.restrict_skus || false,
    approved_sku_ids: community?.approved_sku_ids || [],
    // Extended fields
    start_date: community?.start_date || null,
    end_date: community?.end_date || null,
    default_rep_id: community?.default_rep_id || null,
    priority_crew_ids: community?.priority_crew_ids || [],
    priority_pm_ids: community?.priority_pm_ids || [],
    assigned_rep_id: community?.assigned_rep_id || null,
    preferred_crew_id: community?.preferred_crew_id || null,
    status: community?.status || 'new',
    notes: community?.notes || '',
  });

  const isEditing = !!community;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.client_id) {
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: community.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  // Generate code suggestion based on client and name
  const generateCode = () => {
    const client = clients?.find(c => c.id === formData.client_id);
    if (client && formData.name) {
      const clientPrefix = (client.code || client.name.substring(0, 4)).toUpperCase();
      const communityPart = formData.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
      setFormData({ ...formData, code: `${clientPrefix}-${communityPart}` });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Community' : 'New Community'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a client</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.code ? `(${client.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Community Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Six Creek Ranch"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="PERRY-SIXCREEK"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={generateCode}
                  disabled={!formData.client_id || !formData.name}
                  className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>

          {/* Geography */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Geography (Labor Zone)
            </label>
            <select
              value={formData.geography_id}
              onChange={(e) => setFormData({ ...formData, geography_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select geography</option>
              {geographies?.map((geo) => (
                <option key={geo.id} value={geo.id}>
                  {geo.name} ({geo.code}) - ${geo.base_labor_rate}/hr
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Geography determines labor rates for this community
            </p>
          </div>

          {/* Status & Lifecycle */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Status & Lifecycle</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as CommunityStatus })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(COMMUNITY_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Start Date
                  </div>
                </label>
                <input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    End Date
                  </div>
                </label>
                <input
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    Default Sales Rep
                  </div>
                </label>
                <select
                  value={formData.default_rep_id || ''}
                  onChange={(e) => setFormData({ ...formData, default_rep_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Not assigned</option>
                  {userProfiles?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.display_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-400" />
                    Preferred Crew
                  </div>
                </label>
                <select
                  value={formData.preferred_crew_id || ''}
                  onChange={(e) => setFormData({ ...formData, preferred_crew_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No preference</option>
                  {crews?.filter(c => c.is_active).map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name} ({crew.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Default assignments for new requests and jobs in this community
            </p>
          </div>

          {/* Rate Sheet & QBO Class Override */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                  Rate Sheet (Override)
                </div>
              </label>
              <select
                value={formData.rate_sheet_id || ''}
                onChange={(e) => setFormData({ ...formData, rate_sheet_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Use client's default</option>
                {rateSheets?.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name} {sheet.code ? `(${sheet.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  QBO Class (Override)
                </div>
              </label>
              <select
                value={formData.override_qbo_class_id || ''}
                onChange={(e) => setFormData({ ...formData, override_qbo_class_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Use client's default</option>
                {qboClasses?.map((qboClass) => (
                  <option key={qboClass.id} value={qboClass.id}>
                    {qboClass.fully_qualified_name || qboClass.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-4">
            Override the client's default rate sheet or QBO class for this community only
          </p>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Location</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SKU Restrictions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">SKU Restrictions</h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.restrict_skus}
                onChange={(e) => setFormData({ ...formData, restrict_skus: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Restrict SKUs for this community</span>
                <p className="text-xs text-gray-500">
                  When enabled, only approved SKUs can be selected for quotes in this community
                </p>
              </div>
            </label>

            {formData.restrict_skus && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-700">
                  SKU selection will be available after creating the community.
                  You can manage approved SKUs from the community detail view.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Access instructions, special requirements, etc."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !formData.name.trim() || !formData.client_id}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Community'}
          </button>
        </div>
      </div>
    </div>
  );
}
