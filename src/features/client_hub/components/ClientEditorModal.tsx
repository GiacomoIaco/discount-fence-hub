import { useState } from 'react';
import { X, FileSpreadsheet, BookOpen, User, Truck } from 'lucide-react';
import { useCreateClient, useUpdateClient } from '../hooks/useClients';
import { useRateSheets } from '../hooks/useRateSheets';
import { useQboClasses } from '../hooks/useQboClasses';
import { useTeamMembers } from '../../settings/hooks';
import { useCrews } from '../../fsm/hooks';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import type { AddressFormData } from '../../shared/types/location';
import {
  BUSINESS_UNIT_LABELS,
  CLIENT_TYPE_LABELS,
  type Client,
  type ClientFormData,
  type BusinessUnit,
  type ClientType,
} from '../types';

interface Props {
  client: Client | null;
  onClose: () => void;
}

export default function ClientEditorModal({ client, onClose }: Props) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const { data: rateSheets } = useRateSheets({ is_active: true });
  const { data: qboClasses } = useQboClasses(true); // Only selectable classes
  const { data: teamMembers } = useTeamMembers();
  const { data: crews } = useCrews();

  const [formData, setFormData] = useState<ClientFormData>({
    name: client?.name || '',
    code: client?.code || '',
    business_unit: client?.business_unit || 'builders',
    client_type: client?.client_type || 'custom_builder',
    primary_contact_name: client?.primary_contact_name || '',
    primary_contact_email: client?.primary_contact_email || '',
    primary_contact_phone: client?.primary_contact_phone || '',
    billing_email: client?.billing_email || '',
    address_line1: client?.address_line1 || '',
    address_line2: client?.address_line2 || '',
    city: client?.city || '',
    state: client?.state || 'TX',
    zip: client?.zip || '',
    default_rate_sheet_id: client?.default_rate_sheet_id || null,
    default_qbo_class_id: client?.default_qbo_class_id || null,
    invoicing_frequency: client?.invoicing_frequency || 'per_job',
    payment_terms: client?.payment_terms || 30,
    requires_po: client?.requires_po || false,
    assigned_rep_id: client?.assigned_rep_id || null,
    preferred_crew_id: client?.preferred_crew_id || null,
    notes: client?.notes || '',
  });

  const isEditing = !!client;
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Handler for SmartAddressInput
  const handleAddressChange = (address: AddressFormData) => {
    setFormData(prev => ({
      ...prev,
      address_line1: address.address_line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: client.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Client' : 'New Client'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
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
                  placeholder="PERRY, HIGHLAND, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.business_unit}
                  onChange={(e) => setFormData({ ...formData, business_unit: e.target.value as BusinessUnit })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(BUSINESS_UNIT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.client_type}
                  onChange={(e) => setFormData({ ...formData, client_type: e.target.value as ClientType })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Primary Contact</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.primary_contact_name}
                  onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.primary_contact_email}
                  onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.primary_contact_phone}
                  onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
                <input
                  type="email"
                  value={formData.billing_email}
                  onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Address</h3>

            <SmartAddressInput
              value={{
                address_line1: formData.address_line1,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                latitude: null,
                longitude: null,
              }}
              onChange={handleAddressChange}
              label="Office/Business Address"
              restrictToTexas
              placeholder="Start typing address..."
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                type="text"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                placeholder="Suite, Unit, Building, etc."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Pricing & QBO */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Pricing & QuickBooks</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                    Default Rate Sheet
                  </div>
                </label>
                <select
                  value={formData.default_rate_sheet_id || ''}
                  onChange={(e) => setFormData({ ...formData, default_rate_sheet_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None (use catalog prices)</option>
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
                    QBO Class (P&L)
                  </div>
                </label>
                <select
                  value={formData.default_qbo_class_id || ''}
                  onChange={(e) => setFormData({ ...formData, default_qbo_class_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  {qboClasses?.map((qboClass) => (
                    <option key={qboClass.id} value={qboClass.id}>
                      {qboClass.fully_qualified_name || qboClass.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Rate sheet is used for pricing. QBO Class is used for P&L tracking in QuickBooks.
            </p>
          </div>

          {/* Invoicing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Invoicing</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={formData.invoicing_frequency}
                  onChange={(e) => setFormData({ ...formData, invoicing_frequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="per_job">Per Job</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
                <input
                  type="number"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: parseInt(e.target.value) || 30 })}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requires_po}
                    onChange={(e) => setFormData({ ...formData, requires_po: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Requires PO</span>
                </label>
              </div>
            </div>
          </div>

          {/* Assignment Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Assignment Preferences</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    Assigned Sales Rep
                  </div>
                </label>
                <select
                  value={formData.assigned_rep_id || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_rep_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Not assigned</option>
                  {teamMembers?.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name || member.email}
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
              Default assignments for new requests and jobs from this client
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
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
            disabled={isPending || !formData.name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
