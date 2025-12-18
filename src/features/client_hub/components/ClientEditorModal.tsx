import { useState, useEffect, useMemo } from 'react';
import { X, FileSpreadsheet, User, Truck, Building2, Plus } from 'lucide-react';
import { useCreateClient, useUpdateClient, useClientCrewPreferences, useSetClientCrewPreferences } from '../hooks/useClients';
import { useRateSheets } from '../hooks/useRateSheets';
import { useQboClasses } from '../hooks/useQboClasses';
import { useFsmTeamFull } from '../../fsm/hooks';
import { useCrews } from '../../fsm/hooks';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import type { AddressFormData } from '../../shared/types/location';
import {
  CLIENT_TYPE_LABELS,
  type Client,
  type ClientFormData,
  type ClientType,
} from '../types';

interface Props {
  client: Client | null;
  onClose: () => void;
}

export default function ClientEditorModal({ client, onClose }: Props) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const setCrewPreferencesMutation = useSetClientCrewPreferences();
  const { data: rateSheets } = useRateSheets({ is_active: true });
  const { data: qboClasses } = useQboClasses(true); // Only selectable classes
  const { data: fsmTeamMembers } = useFsmTeamFull();
  const { data: crews } = useCrews();
  const { data: existingCrewPrefs } = useClientCrewPreferences(client?.id || null);

  // Determine initial client_type based on whether company_name exists
  const getInitialClientType = (): ClientType => {
    if (client?.client_type) return client.client_type;
    // Default: homeowner for individuals, empty for companies (user must choose)
    return client?.company_name ? 'other' : 'homeowner';
  };

  const [formData, setFormData] = useState<ClientFormData>({
    name: client?.name || '',
    code: client?.code || '',
    company_name: client?.company_name || '',
    business_unit: client?.business_unit || 'residential', // Keep for DB compatibility
    client_type: getInitialClientType(),
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

  // Multi-crew preferences (local state, saved separately)
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);

  // Load existing crew preferences when editing
  useEffect(() => {
    if (existingCrewPrefs && existingCrewPrefs.length > 0) {
      setSelectedCrewIds(existingCrewPrefs.map(p => p.crew_id));
    }
  }, [existingCrewPrefs]);

  // Update business_unit based on QBO Class selection (derive from QBO class name)
  useEffect(() => {
    if (formData.default_qbo_class_id && qboClasses) {
      const selectedClass = qboClasses.find(c => c.id === formData.default_qbo_class_id);
      if (selectedClass) {
        const name = selectedClass.name.toLowerCase();
        if (name.includes('builder')) {
          setFormData(prev => ({ ...prev, business_unit: 'builders' }));
        } else if (name.includes('commercial')) {
          setFormData(prev => ({ ...prev, business_unit: 'commercial' }));
        } else {
          setFormData(prev => ({ ...prev, business_unit: 'residential' }));
        }
      }
    }
  }, [formData.default_qbo_class_id, qboClasses]);

  // When company_name changes, adjust client_type if needed
  const handleCompanyNameChange = (value: string) => {
    setFormData(prev => {
      const newData = { ...prev, company_name: value };
      // If adding company name and current type is homeowner, clear it to force selection
      if (value && prev.client_type === 'homeowner') {
        newData.client_type = 'other';
      }
      // If removing company name, default back to homeowner
      if (!value && !client?.company_name) {
        newData.client_type = 'homeowner';
      }
      return newData;
    });
  };

  const isEditing = !!client;
  const isPending = createMutation.isPending || updateMutation.isPending || setCrewPreferencesMutation.isPending;
  const hasCompany = !!formData.company_name.trim();

  // Filter reps by selected QBO Class (BU assignment)
  const filteredReps = useMemo(() => {
    if (!fsmTeamMembers) return [];

    // Get reps only (those with 'rep' in fsm_roles)
    const reps = fsmTeamMembers.filter(m =>
      m.is_active && m.fsm_roles?.includes('rep')
    );

    // If a QBO Class is selected, filter reps who are assigned to that class
    if (formData.default_qbo_class_id) {
      return reps.filter(rep => {
        const assignedClasses = rep.assigned_qbo_class_ids || [];
        // Show reps who either have no class restrictions OR are assigned to this class
        return assignedClasses.length === 0 || assignedClasses.includes(formData.default_qbo_class_id!);
      });
    }

    return reps;
  }, [fsmTeamMembers, formData.default_qbo_class_id]);

  // Available crews for selection (not already selected)
  const availableCrews = useMemo(() => {
    if (!crews) return [];
    return crews.filter(c => c.is_active && !selectedCrewIds.includes(c.id));
  }, [crews, selectedCrewIds]);

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

  // Add crew to preferences
  const handleAddCrew = (crewId: string) => {
    setSelectedCrewIds(prev => [...prev, crewId]);
  };

  // Remove crew from preferences
  const handleRemoveCrew = (crewId: string) => {
    setSelectedCrewIds(prev => prev.filter(id => id !== crewId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    try {
      let clientId = client?.id;

      if (isEditing) {
        await updateMutation.mutateAsync({ id: client.id, data: formData });
      } else {
        const newClient = await createMutation.mutateAsync(formData);
        clientId = newClient.id;
      }

      // Save crew preferences
      if (clientId) {
        await setCrewPreferencesMutation.mutateAsync({
          clientId,
          crewIds: selectedCrewIds,
        });
      }

      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  // Get crew info by ID
  const getCrewById = (crewId: string) => {
    return crews?.find(c => c.id === crewId);
  };

  // Client type options based on whether it's a company or individual
  const clientTypeOptions = hasCompany
    ? Object.entries(CLIENT_TYPE_LABELS).filter(([key]) => key !== 'homeowner')
    : Object.entries(CLIENT_TYPE_LABELS);

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
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Client Information</h3>

            {/* Company Name (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Company Name <span className="text-gray-400 font-normal">(optional)</span>
                </div>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                placeholder="Leave blank for individual clients"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Contact Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {hasCompany ? 'Contact Name' : 'Client Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={hasCompany ? "Primary contact person" : "Client's full name"}
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
                  placeholder="PERRY, SMITH, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Client Type - required for companies, defaults to homeowner for individuals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Type {hasCompany && <span className="text-red-500">*</span>}
              </label>
              <select
                value={formData.client_type}
                onChange={(e) => setFormData({ ...formData, client_type: e.target.value as ClientType })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required={hasCompany}
              >
                {hasCompany && <option value="">Select type...</option>}
                {clientTypeOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Contact Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.primary_contact_email}
                  onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.primary_contact_phone}
                  onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
              <input
                type="email"
                value={formData.billing_email}
                onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                placeholder="If different from contact email"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
              label={hasCompany ? "Office Address" : "Address"}
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

          {/* Business & Pricing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Business & Pricing</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BU (Business Unit)
                </label>
                <select
                  value={formData.default_qbo_class_id || ''}
                  onChange={(e) => setFormData({ ...formData, default_qbo_class_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select BU...</option>
                  {qboClasses?.map((qboClass) => (
                    <option key={qboClass.id} value={qboClass.id}>
                      {qboClass.fully_qualified_name || qboClass.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Used for P&L tracking</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                    Rate Sheet
                  </div>
                </label>
                <select
                  value={formData.default_rate_sheet_id || ''}
                  onChange={(e) => setFormData({ ...formData, default_rate_sheet_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Default pricing</option>
                  {rateSheets?.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name} {sheet.code ? `(${sheet.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Assigned Rep
                </div>
              </label>
              <select
                value={formData.assigned_rep_id || ''}
                onChange={(e) => setFormData({ ...formData, assigned_rep_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Not assigned</option>
                {filteredReps.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
              {formData.default_qbo_class_id && (
                <p className="mt-1 text-xs text-gray-500">
                  Filtered by selected BU
                </p>
              )}
            </div>

            {/* Multi-select Preferred Crews */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-gray-400" />
                  Preferred Crews
                </div>
              </label>

              {/* Selected crews as chips */}
              {selectedCrewIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedCrewIds.map((crewId, index) => {
                    const crew = getCrewById(crewId);
                    if (!crew) return null;
                    return (
                      <span
                        key={crewId}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                          crew.is_subcontractor
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {index === 0 && <span className="text-xs font-medium">#1</span>}
                        {crew.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveCrew(crewId)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Add crew dropdown */}
              {availableCrews.length > 0 && (
                <div className="flex gap-2">
                  <select
                    id="add-crew-select"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddCrew(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Add a crew...</option>
                    {availableCrews.map((crew) => (
                      <option key={crew.id} value={crew.id}>
                        {crew.name} ({crew.code}) {crew.is_subcontractor ? '- Sub' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const select = document.getElementById('add-crew-select') as HTMLSelectElement;
                      if (select?.value) {
                        handleAddCrew(select.value);
                        select.value = '';
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              <p className="mt-1 text-xs text-gray-500">
                First crew is primary preference
              </p>
            </div>
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
