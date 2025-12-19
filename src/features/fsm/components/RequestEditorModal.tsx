import { useState, useEffect, useMemo } from 'react';
import { X, Phone, Globe, Users, Building, FileText, Wrench, Shield, Check } from 'lucide-react';
import { useCreateRequest, useUpdateRequest } from '../hooks';
import { useTerritories, useSalesReps } from '../hooks';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';
import { ClientLookup, PropertyLookup } from '../../../components/common/SmartLookup';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import type { AddressFormData } from '../../shared/types/location';
import type { SelectedEntity } from '../../../components/common/SmartLookup';
import type { Property } from '../../client_hub/types';
import type { ServiceRequest, RequestFormData, RequestSource, RequestType, Priority } from '../types';
import { PRODUCT_TYPES } from '../types';

interface RequestEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: ServiceRequest | null;
}

const SOURCES: { value: RequestSource; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'web', label: 'Website', icon: Globe },
  { value: 'referral', label: 'Referral', icon: Users },
  { value: 'walk_in', label: 'Walk-in', icon: Building },
  { value: 'builder_portal', label: 'Builder Portal', icon: Building },
];

const REQUEST_TYPES: { value: RequestType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'new_quote', label: 'New Quote', icon: FileText, color: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'repair', label: 'Repair', icon: Wrench, color: 'border-orange-500 bg-orange-50 text-orange-700' },
  { value: 'warranty', label: 'Warranty', icon: Shield, color: 'border-purple-500 bg-purple-50 text-purple-700' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-600' },
];

const INITIAL_FORM_DATA: RequestFormData = {
  client_id: '',
  community_id: '',
  property_id: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address_line1: '',
  city: '',
  state: 'TX',
  zip: '',
  source: 'phone',
  request_type: 'new_quote',
  product_types: [],
  linear_feet_estimate: '',
  description: '',
  notes: '',
  requires_assessment: true,
  assessment_scheduled_at: '',
  business_unit_id: '',
  assigned_rep_id: '',
  territory_id: '',
  priority: 'normal',
  latitude: null,
  longitude: null,
};

export default function RequestEditorModal({ isOpen, onClose, request }: RequestEditorModalProps) {
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);

  // Smart lookup state
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const { data: territories } = useTerritories();
  const { data: salesReps } = useSalesReps();
  const { data: businessUnits } = useBusinessUnits();

  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest();

  const isEditing = !!request;

  // Filter reps by selected business unit
  const filteredReps = useMemo(() => {
    if (!salesReps) return [];
    if (!formData.business_unit_id) return salesReps.filter(r => r.is_active);

    // Filter reps who have the selected BU in their assigned BUs
    // For now, show all active reps (BU filtering can be enhanced with fsm_team_profiles)
    return salesReps.filter(r => r.is_active);
  }, [salesReps, formData.business_unit_id]);

  // Reset form when modal opens/closes or request changes
  useEffect(() => {
    if (isOpen && request) {
      setFormData({
        client_id: request.client_id || '',
        community_id: request.community_id || '',
        property_id: request.property_id || '',
        contact_name: request.contact_name || '',
        contact_email: request.contact_email || '',
        contact_phone: request.contact_phone || '',
        address_line1: request.address_line1 || '',
        city: request.city || '',
        state: request.state || 'TX',
        zip: request.zip || '',
        source: request.source,
        request_type: request.request_type || 'new_quote',
        product_types: request.product_types || [],
        linear_feet_estimate: request.linear_feet_estimate?.toString() || '',
        description: request.description || '',
        notes: request.notes || '',
        requires_assessment: request.requires_assessment,
        assessment_scheduled_at: request.assessment_scheduled_at || '',
        business_unit_id: request.business_unit_id || '',
        assigned_rep_id: request.assigned_rep_id || '',
        territory_id: request.territory_id || '',
        priority: request.priority,
      });
      setSelectedEntity(null);
      setSelectedProperty(null);
    } else if (isOpen) {
      setFormData(INITIAL_FORM_DATA);
      setSelectedEntity(null);
      setSelectedProperty(null);
    }
  }, [isOpen, request]);

  // Sync selected entity to form data
  useEffect(() => {
    if (selectedEntity) {
      setFormData(prev => ({
        ...prev,
        client_id: selectedEntity.client.id,
        community_id: selectedEntity.community?.id || '',
        contact_name: prev.contact_name || selectedEntity.client.primary_contact_name || '',
        contact_phone: prev.contact_phone || selectedEntity.client.primary_contact_phone || '',
        contact_email: prev.contact_email || selectedEntity.client.primary_contact_email || '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        community_id: '',
      }));
    }
  }, [selectedEntity]);

  // Sync selected property to form data
  useEffect(() => {
    if (selectedProperty) {
      setFormData(prev => ({
        ...prev,
        property_id: selectedProperty.id,
        address_line1: selectedProperty.address_line1,
        city: selectedProperty.city || prev.city,
        state: selectedProperty.state || prev.state,
        zip: selectedProperty.zip || prev.zip,
        latitude: selectedProperty.latitude ?? null,
        longitude: selectedProperty.longitude ?? null,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        property_id: '',
      }));
    }
  }, [selectedProperty]);

  // Handler for SmartAddressInput
  const handleAddressChange = (address: AddressFormData) => {
    setFormData(prev => ({
      ...prev,
      address_line1: address.address_line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
  };

  // Auto-detect territory from zip code
  useEffect(() => {
    if (formData.zip && territories && !formData.territory_id) {
      const matchingTerritory = territories.find(t =>
        t.zip_codes.some(z => z.trim() === formData.zip.trim())
      );
      if (matchingTerritory) {
        setFormData(prev => ({ ...prev, territory_id: matchingTerritory.id }));
      }
    }
  }, [formData.zip, territories, formData.territory_id]);

  // Toggle product type selection
  const toggleProductType = (productType: string) => {
    setFormData(prev => ({
      ...prev,
      product_types: prev.product_types.includes(productType)
        ? prev.product_types.filter(pt => pt !== productType)
        : [...prev.product_types, productType],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && request) {
      await updateMutation.mutateAsync({ id: request.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }

    onClose();
  };

  const updateField = <K extends keyof RequestFormData>(field: K, value: RequestFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">
            {isEditing ? `Edit Request ${request.request_number}` : 'New Service Request'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ===== SECTION 1: Customer & Address (First!) ===== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Customer & Location</h3>

            {/* Smart Client/Community Lookup */}
            <ClientLookup
              value={selectedEntity}
              onChange={setSelectedEntity}
              label="Customer"
              placeholder="Search by name, phone, email, or community..."
              onClientCreated={(client) => {
                // New clients created here are quick-add leads
                console.log('New lead created:', client);
              }}
            />
            <p className="text-xs text-gray-500">
              Type to search existing clients, or create a new lead
            </p>

            {/* Smart Property Lookup (only shown when client is selected) */}
            {selectedEntity && (
              <PropertyLookup
                clientId={selectedEntity.client.id}
                client={selectedEntity.client}
                value={selectedProperty}
                onChange={setSelectedProperty}
                label="Property / Job Site"
                placeholder="Search address or lot number..."
                onPropertyCreated={(property) => {
                  console.log('New property created:', property);
                }}
              />
            )}

            {/* Manual Address Entry (shown when no property selected) */}
            {!selectedProperty && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedEntity ? 'Or Enter Address Manually' : 'Job Address'}
                </label>
                <SmartAddressInput
                  value={{
                    address_line1: formData.address_line1,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    latitude: formData.latitude ?? null,
                    longitude: formData.longitude ?? null,
                  }}
                  onChange={handleAddressChange}
                  label=""
                  restrictToTexas
                  placeholder="Start typing address..."
                />
              </div>
            )}

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  placeholder="512-555-1234"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ===== SECTION 2: Business Unit ===== */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Business Unit</h3>
            <div className="flex flex-wrap gap-2">
              {businessUnits?.map((bu) => (
                <button
                  key={bu.id}
                  type="button"
                  onClick={() => updateField('business_unit_id', formData.business_unit_id === bu.id ? '' : bu.id)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    formData.business_unit_id === bu.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {bu.name}
                </button>
              ))}
            </div>
          </div>

          {/* ===== SECTION 3: Request Type ===== */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Request Type</h3>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField('request_type', value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                    formData.request_type === value
                      ? color
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ===== SECTION 4: Product Types (Multi-Select) ===== */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Product Types <span className="font-normal text-gray-400">(select all that apply)</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PRODUCT_TYPES.map((pt) => {
                const isSelected = formData.product_types.includes(pt);
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => toggleProductType(pt)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4" />}
                    {pt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== SECTION 5: Project Details ===== */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Project Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Est. Linear Feet</label>
                <input
                  type="number"
                  value={formData.linear_feet_estimate}
                  onChange={(e) => updateField('linear_feet_estimate', e.target.value)}
                  placeholder="e.g., 150"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => updateField('source', e.target.value as RequestSource)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {SOURCES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                placeholder="Describe the project scope, customer needs, special requirements..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField('priority', value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.priority === value
                        ? color
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ===== SECTION 6: Assignment & Scheduling ===== */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Assignment & Scheduling</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
                <select
                  value={formData.territory_id}
                  onChange={(e) => updateField('territory_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Auto-detect from ZIP --</option>
                  {territories?.filter(t => t.is_active).map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
                {formData.zip && !formData.territory_id && (
                  <p className="text-xs text-amber-600 mt-1">No territory found for ZIP {formData.zip}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Rep
                  {formData.business_unit_id && <span className="text-xs text-gray-400 ml-1">(filtered by BU)</span>}
                </label>
                <select
                  value={formData.assigned_rep_id}
                  onChange={(e) => updateField('assigned_rep_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Unassigned --</option>
                  {filteredReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assessment Scheduling */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={formData.requires_assessment}
                  onChange={(e) => updateField('requires_assessment', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Requires Site Assessment</span>
              </label>

              {formData.requires_assessment && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Schedule Assessment</label>
                  <input
                    type="datetime-local"
                    value={formData.assessment_scheduled_at}
                    onChange={(e) => updateField('assessment_scheduled_at', e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank to assign without scheduling (rep picks time in Schedule Hub)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Internal Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={2}
              placeholder="Notes for internal team only..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-yellow-50"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
