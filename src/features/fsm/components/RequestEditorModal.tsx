import { useState, useEffect, useMemo } from 'react';
import { X, FileText, Wrench, Shield, Check, ChevronDown, ChevronUp } from 'lucide-react';
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

const SOURCES: { value: RequestSource; label: string }[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'web', label: 'Web' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'builder_portal', label: 'Builder' },
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
  const [showContactOverride, setShowContactOverride] = useState(false);

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
    return salesReps.filter(r => r.is_active);
  }, [salesReps]);

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
      setShowContactOverride(false);
    } else if (isOpen) {
      setFormData(INITIAL_FORM_DATA);
      setSelectedEntity(null);
      setSelectedProperty(null);
      setShowContactOverride(false);
    }
  }, [isOpen, request]);

  // Sync selected entity to form data
  useEffect(() => {
    if (selectedEntity) {
      setFormData(prev => ({
        ...prev,
        client_id: selectedEntity.client.id,
        community_id: selectedEntity.community?.id || '',
        contact_name: selectedEntity.client.primary_contact_name || '',
        contact_phone: selectedEntity.client.primary_contact_phone || '',
        contact_email: selectedEntity.client.primary_contact_email || '',
      }));
      setShowContactOverride(false);
    } else {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        community_id: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] overflow-hidden m-4">
        {/* Header */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEditing ? `Edit ${request.request_number}` : 'New Service Request'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(95vh-120px)]">
          {/* Two-Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
            {/* LEFT PANEL: Customer & Location */}
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer & Location</h3>

              {/* Client Lookup */}
              <ClientLookup
                value={selectedEntity}
                onChange={setSelectedEntity}
                label="Customer"
                placeholder="Search clients..."
                onClientCreated={(client) => console.log('Lead created:', client)}
              />

              {/* Property Lookup (when client selected) */}
              {selectedEntity && (
                <PropertyLookup
                  clientId={selectedEntity.client.id}
                  client={selectedEntity.client}
                  value={selectedProperty}
                  onChange={setSelectedProperty}
                  label="Property"
                  placeholder="Search properties..."
                  onPropertyCreated={(property) => console.log('Property created:', property)}
                />
              )}

              {/* Address (when no property selected) */}
              {!selectedProperty && (
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
                  label={selectedEntity ? 'Or enter address' : 'Job Address'}
                  restrictToTexas
                  placeholder="Start typing..."
                />
              )}

              {/* Contact Override (collapsible when client selected) */}
              {selectedEntity ? (
                <div className="border rounded-lg">
                  <button
                    type="button"
                    onClick={() => setShowContactOverride(!showContactOverride)}
                    className="w-full px-3 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <span>Contact: {formData.contact_name || 'N/A'} {formData.contact_phone && `• ${formData.contact_phone}`}</span>
                    {showContactOverride ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showContactOverride && (
                    <div className="px-3 pb-3 grid grid-cols-2 gap-2 border-t">
                      <input
                        type="text"
                        value={formData.contact_name}
                        onChange={(e) => updateField('contact_name', e.target.value)}
                        placeholder="Name"
                        className="mt-2 px-2 py-1.5 border rounded text-sm"
                      />
                      <input
                        type="tel"
                        value={formData.contact_phone}
                        onChange={(e) => updateField('contact_phone', e.target.value)}
                        placeholder="Phone"
                        className="mt-2 px-2 py-1.5 border rounded text-sm"
                      />
                      <input
                        type="email"
                        value={formData.contact_email}
                        onChange={(e) => updateField('contact_email', e.target.value)}
                        placeholder="Email"
                        className="col-span-2 px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => updateField('contact_name', e.target.value)}
                    placeholder="Contact Name *"
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => updateField('contact_phone', e.target.value)}
                    placeholder="Phone *"
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => updateField('contact_email', e.target.value)}
                    placeholder="Email"
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              {/* Territory & Assignment */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Territory</label>
                  <select
                    value={formData.territory_id}
                    onChange={(e) => updateField('territory_id', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  >
                    <option value="">Auto-detect</option>
                    {territories?.filter(t => t.is_active).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Assign Rep</label>
                  <select
                    value={formData.assigned_rep_id}
                    onChange={(e) => updateField('assigned_rep_id', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  >
                    <option value="">Unassigned</option>
                    {filteredReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>{rep.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assessment Scheduling */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.requires_assessment}
                    onChange={(e) => updateField('requires_assessment', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-medium">Requires Assessment</span>
                </label>
                {formData.requires_assessment && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={formData.assessment_scheduled_at}
                      onChange={(e) => updateField('assessment_scheduled_at', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave blank for Schedule Hub</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Request Details */}
            <div className="p-4 space-y-4">
              {/* Business Unit */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Unit</h3>
                <div className="flex flex-wrap gap-1.5">
                  {businessUnits?.map((bu) => (
                    <button
                      key={bu.id}
                      type="button"
                      onClick={() => updateField('business_unit_id', formData.business_unit_id === bu.id ? '' : bu.id)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
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

              {/* Request Type */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Request Type</h3>
                <div className="flex gap-2">
                  {REQUEST_TYPES.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('request_type', value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                        formData.request_type === value ? color : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Types */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Product Types <span className="font-normal text-gray-400">(select all)</span>
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRODUCT_TYPES.map((pt) => {
                    const isSelected = formData.product_types.includes(pt);
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => toggleProductType(pt)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded border text-xs transition-colors ${
                          isSelected
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span className="truncate">{pt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source & Linear Feet */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => updateField('source', e.target.value as RequestSource)}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  >
                    {SOURCES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Est. Linear Feet</label>
                  <input
                    type="number"
                    value={formData.linear_feet_estimate}
                    onChange={(e) => updateField('linear_feet_estimate', e.target.value)}
                    placeholder="e.g., 150"
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <div className="flex gap-1.5">
                  {PRIORITIES.map(({ value, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('priority', value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        formData.priority === value ? color : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={2}
                  placeholder="Project scope, requirements..."
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={2}
                  placeholder="Internal team notes..."
                  className="w-full px-2 py-1.5 border rounded text-sm bg-yellow-50"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-gray-50 border-t px-6 py-3 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
