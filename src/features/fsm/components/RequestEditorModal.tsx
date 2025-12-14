import { useState, useEffect } from 'react';
import { X, Phone, Globe, Users, Building } from 'lucide-react';
import { useCreateRequest, useUpdateRequest } from '../hooks';
import { useTerritories, useSalesReps } from '../hooks';
import { ClientLookup, PropertyLookup } from '../../../components/common/SmartLookup';
import type { SelectedEntity } from '../../../components/common/SmartLookup';
import type { Property } from '../../client_hub/types';
import type { ServiceRequest, RequestFormData, RequestSource, Priority } from '../types';

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

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-600' },
];

const PRODUCT_TYPE_OPTIONS = [
  'Wood Vertical',
  'Wood Horizontal',
  'Iron',
  'Chain Link',
  'Vinyl',
  'Gate',
  'Deck',
  'Glass Railing',
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
  product_type: '',
  linear_feet_estimate: '',
  description: '',
  notes: '',
  requires_assessment: true,
  assessment_scheduled_at: '',
  assigned_rep_id: '',
  territory_id: '',
  priority: 'normal',
};

export default function RequestEditorModal({ isOpen, onClose, request }: RequestEditorModalProps) {
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);

  // Smart lookup state
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const { data: territories } = useTerritories();
  const { data: salesReps } = useSalesReps();

  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest();

  const isEditing = !!request;

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
        product_type: request.product_type || '',
        linear_feet_estimate: request.linear_feet_estimate?.toString() || '',
        description: request.description || '',
        notes: request.notes || '',
        requires_assessment: request.requires_assessment,
        assessment_scheduled_at: request.assessment_scheduled_at || '',
        assigned_rep_id: request.assigned_rep_id || '',
        territory_id: request.territory_id || '',
        priority: request.priority,
      });
      // TODO: Load existing client/community/property for editing
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
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        property_id: '',
      }));
    }
  }, [selectedProperty]);

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
          {/* Source Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Source <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField('source', value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
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
                {selectedEntity ? 'Or Enter Address Manually' : 'Job Address'}
              </label>
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.address_line1}
                  onChange={(e) => updateField('address_line1', e.target.value)}
                  placeholder="Street Address"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-6 gap-3">
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="City"
                    className="col-span-3 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    placeholder="State"
                    className="col-span-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => updateField('zip', e.target.value)}
                    placeholder="ZIP"
                    className="col-span-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contact Info (editable, pre-filled from client) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  placeholder="512-555-1234"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Email</label>
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

          {/* Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
              <select
                value={formData.product_type}
                onChange={(e) => updateField('product_type', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select --</option>
                {PRODUCT_TYPE_OPTIONS.map((pt) => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>
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
          </div>

          {/* Description */}
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

          {/* Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
              <select
                value={formData.territory_id}
                onChange={(e) => updateField('territory_id', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Auto-detect --</option>
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

          {/* Assessment */}
          <div className="border-t pt-4">
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
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div>
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
