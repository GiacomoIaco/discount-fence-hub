/**
 * RequestEditorPage - Full page for creating/editing service requests
 *
 * Routes:
 * - /requests/new → Create new request
 * - /requests/:id/edit → Edit existing request
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Phone, Globe, Users, Building, Save, AlertCircle } from 'lucide-react';
import { useCreateRequest, useUpdateRequest, useRequest } from '../hooks';
import { useTerritories, useSalesReps } from '../hooks';
import { ClientLookup, PropertyLookup } from '../../../components/common/SmartLookup';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import type { AddressFormData } from '../../shared/types/location';
import type { SelectedEntity } from '../../../components/common/SmartLookup';
import type { Property } from '../../client_hub/types';
import type { RequestFormData, RequestSource, Priority } from '../types';
import { PRODUCT_TYPES } from '../types';

interface RequestEditorPageProps {
  requestId?: string; // If provided, we're editing; otherwise creating
  onBack: () => void;
  onSaved?: (requestId: string) => void;
}

const SOURCES: { value: RequestSource; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'web', label: 'Website', icon: Globe },
  { value: 'referral', label: 'Referral', icon: Users },
  { value: 'walk_in', label: 'Walk-in', icon: Building },
  { value: 'builder_portal', label: 'Builder Portal', icon: Building },
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
  // Geocoding fields
  latitude: null,
  longitude: null,
};

export default function RequestEditorPage({
  requestId,
  onBack,
  onSaved,
}: RequestEditorPageProps) {
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);

  // Smart lookup state
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const { data: existingRequest, isLoading: isLoadingRequest } = useRequest(requestId);
  const { data: territories } = useTerritories();
  const { data: salesReps } = useSalesReps();

  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest();

  const isEditing = !!requestId;

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Validate required fields
  const validateForm = useMemo(() => {
    const errors: string[] = [];

    // Must have either a client or contact info
    const hasClient = !!formData.client_id;
    const hasContactName = !!formData.contact_name.trim();
    const hasContactMethod = !!formData.contact_phone.trim() || !!formData.contact_email.trim();

    if (!hasClient && !hasContactName) {
      errors.push('Customer name is required (select a client or enter contact name)');
    }

    if (!hasClient && hasContactName && !hasContactMethod) {
      errors.push('Phone or email is required for new contacts');
    }

    // Must have an address
    const hasAddress = !!formData.address_line1.trim();
    if (!hasAddress) {
      errors.push('Job site address is required');
    }

    return errors;
  }, [formData.client_id, formData.contact_name, formData.contact_phone, formData.contact_email, formData.address_line1]);

  const isFormValid = validateForm.length === 0;

  // Load existing request data when editing
  useEffect(() => {
    if (existingRequest) {
      setFormData({
        client_id: existingRequest.client_id || '',
        community_id: existingRequest.community_id || '',
        property_id: existingRequest.property_id || '',
        contact_name: existingRequest.contact_name || '',
        contact_email: existingRequest.contact_email || '',
        contact_phone: existingRequest.contact_phone || '',
        address_line1: existingRequest.address_line1 || '',
        city: existingRequest.city || '',
        state: existingRequest.state || 'TX',
        zip: existingRequest.zip || '',
        source: existingRequest.source,
        request_type: existingRequest.request_type || 'new_quote',
        product_types: existingRequest.product_types || [],
        linear_feet_estimate: existingRequest.linear_feet_estimate?.toString() || '',
        description: existingRequest.description || '',
        notes: existingRequest.notes || '',
        requires_assessment: existingRequest.requires_assessment,
        assessment_scheduled_at: existingRequest.assessment_scheduled_at || '',
        business_unit_id: existingRequest.business_unit_id || '',
        assigned_rep_id: existingRequest.assigned_rep_id || '',
        territory_id: existingRequest.territory_id || '',
        priority: existingRequest.priority,
      });

      // Load existing client entity for display
      if (existingRequest.client) {
        const communityName = existingRequest.community?.name;
        const clientName = existingRequest.client.name;
        setSelectedEntity({
          client: existingRequest.client as any,
          community: existingRequest.community as any,
          display_name: communityName ? `${communityName} (${clientName})` : clientName,
        });
      }

      // Load existing property for display
      if (existingRequest.property) {
        setSelectedProperty(existingRequest.property as any);
      }
    }
  }, [existingRequest]);

  // Sync selected entity to form data
  useEffect(() => {
    if (selectedEntity) {
      setFormData(prev => ({
        ...prev,
        client_id: selectedEntity.client.id,
        community_id: selectedEntity.community?.id || '',
        // Pre-fill contact info from client if no manual entry
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
    // Clear validation errors when user starts fixing the form
    if (showValidationErrors) {
      setShowValidationErrors(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Show validation errors if form is invalid
    if (!isFormValid) {
      setValidationErrors(validateForm);
      setShowValidationErrors(true);
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setShowValidationErrors(false);

    try {
      if (isEditing && requestId) {
        await updateMutation.mutateAsync({ id: requestId, data: formData });
        onSaved?.(requestId);
        onBack();
      } else {
        const result = await createMutation.mutateAsync(formData);
        // Navigate back first, then call onSaved which may trigger additional navigation
        onBack();
        onSaved?.(result.id);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const updateField = <K extends keyof RequestFormData>(field: K, value: RequestFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation errors when user starts fixing the form
    if (showValidationErrors) {
      setShowValidationErrors(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading request...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEditing
                    ? `Edit Request ${existingRequest?.request_number || ''}`
                    : 'New Service Request'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {isEditing ? 'Update request details' : 'Create a new client service request'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Request'}
            </button>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {showValidationErrors && validationErrors.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Please fix the following errors:</h3>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Source Selection */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Source</h2>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField('source', value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                    formData.source === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-6">
              {/* Smart Client/Community Lookup */}
              <div>
                <ClientLookup
                  value={selectedEntity}
                  onChange={setSelectedEntity}
                  label="Customer"
                  placeholder="Search by name, phone, email, or community..."
                  onClientCreated={(client) => {
                    console.log('New client created:', client);
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Type to search existing clients and communities, or create a new one
                </p>
              </div>

              {/* Smart Property Lookup (only shown when client is selected) */}
              {selectedEntity && (
                <div>
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
                </div>
              )}

              {/* Manual Address Entry (shown when no property selected) */}
              {!selectedProperty && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedEntity ? 'Or Enter Address Manually' : 'Job Address'} <span className="text-red-500">*</span>
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
                    required
                    restrictToTexas
                    placeholder="Start typing address..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Contact Info Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name {!formData.client_id && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone {!formData.client_id && !formData.contact_email.trim() && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  placeholder="512-555-1234"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email {!formData.client_id && !formData.contact_phone.trim() && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Project Details Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
            <div className="space-y-4">
              {/* Product Types Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Types <span className="font-normal text-gray-500">(select all that apply)</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PRODUCT_TYPES.map((pt) => {
                    const isSelected = formData.product_types.includes(pt);
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            product_types: prev.product_types.includes(pt)
                              ? prev.product_types.filter(p => p !== pt)
                              : [...prev.product_types, pt],
                          }));
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          isSelected
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {pt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Est. Linear Feet</label>
                <input
                  type="number"
                  value={formData.linear_feet_estimate}
                  onChange={(e) => updateField('linear_feet_estimate', e.target.value)}
                  placeholder="e.g., 150"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 max-w-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  placeholder="Describe the project scope, customer needs, special requirements..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map(({ value, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('priority', value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
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
          </div>

          {/* Assignment Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Rep</label>
                <select
                  value={formData.assigned_rep_id}
                  onChange={(e) => updateField('assigned_rep_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Unassigned --</option>
                  {salesReps?.filter(r => r.is_active).map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assessment Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.requires_assessment}
                  onChange={(e) => updateField('requires_assessment', e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-700">Requires Site Assessment</span>
              </label>

              {formData.requires_assessment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Assessment</label>
                  <input
                    type="datetime-local"
                    value={formData.assessment_scheduled_at}
                    onChange={(e) => updateField('assessment_scheduled_at', e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Internal Notes Section */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Internal Notes</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              placeholder="Notes for internal team only (not visible to customer)..."
              className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white"
            />
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
