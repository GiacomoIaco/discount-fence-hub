import { useState, useEffect, useMemo } from 'react';
import { X, FileText, Wrench, Shield, Check, User, MapPin, Building2, ChevronRight } from 'lucide-react';
import { useCreateRequest, useUpdateRequest } from '../hooks';
import { useTerritories, useSalesReps } from '../hooks';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';
import { useClientProperties } from '../../client_hub/hooks/useProperties';
import { supabase } from '../../../lib/supabase';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import type { AddressFormData } from '../../shared/types/location';
// Property subset for the client properties panel
interface ClientProperty {
  id: string;
  address_line1: string;
  city: string | null;
  state: string;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  community_name: string;
}
import type { ServiceRequest, RequestFormData, RequestSource, RequestType, Priority } from '../types';
import { PRODUCT_TYPES } from '../types';

interface RequestEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: ServiceRequest | null;
}

interface ClientSearchResult {
  id: string;
  name: string;
  company_name: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
}

const REQUEST_TYPES: { value: RequestType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'new_quote', label: 'New Quote', icon: FileText, color: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'repair', label: 'Repair', icon: Wrench, color: 'border-orange-500 bg-orange-50 text-orange-700' },
  { value: 'warranty', label: 'Warranty', icon: Shield, color: 'border-purple-500 bg-purple-50 text-purple-700' },
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

  // Client search state
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: territories } = useTerritories();
  const { data: salesReps } = useSalesReps();
  const { data: businessUnits } = useBusinessUnits();
  const { data: clientProperties } = useClientProperties(selectedClient?.id || null);

  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest();

  const isEditing = !!request;

  const filteredReps = useMemo(() => {
    if (!salesReps) return [];
    return salesReps.filter(r => r.is_active);
  }, [salesReps]);

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const search = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, company_name, primary_contact_name, primary_contact_phone, primary_contact_email')
        .or(`name.ilike.%${clientSearch}%,company_name.ilike.%${clientSearch}%,primary_contact_phone.ilike.%${clientSearch}%`)
        .limit(5);
      setClientResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  // Reset form when modal opens
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
    } else if (isOpen) {
      setFormData(INITIAL_FORM_DATA);
      setSelectedClient(null);
      setClientSearch('');
      setShowClientPanel(false);
      setSelectedPropertyId(null);
    }
  }, [isOpen, request]);

  // Auto-detect territory from zip
  useEffect(() => {
    if (formData.zip && territories && !formData.territory_id) {
      const match = territories.find(t => t.zip_codes.some(z => z.trim() === formData.zip.trim()));
      if (match) setFormData(prev => ({ ...prev, territory_id: match.id }));
    }
  }, [formData.zip, territories, formData.territory_id]);

  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      contact_name: client.primary_contact_name || client.name,
      contact_phone: client.primary_contact_phone || '',
      contact_email: client.primary_contact_email || '',
    }));
    setClientSearch('');
    setClientResults([]);
    setShowClientPanel(true);
  };

  const handleSelectProperty = (property: ClientProperty) => {
    setSelectedPropertyId(property.id);
    setFormData(prev => ({
      ...prev,
      property_id: property.id,
      address_line1: property.address_line1,
      city: property.city || '',
      state: property.state || 'TX',
      zip: property.zip || '',
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
    }));
  };

  const handleAddressChange = (address: AddressFormData) => {
    setSelectedPropertyId(null); // Clear property selection when manually entering
    setFormData(prev => ({
      ...prev,
      property_id: '',
      address_line1: address.address_line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
      latitude: address.latitude,
      longitude: address.longitude,
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

  const toggleProductType = (pt: string) => {
    setFormData(prev => ({
      ...prev,
      product_types: prev.product_types.includes(pt)
        ? prev.product_types.filter(p => p !== pt)
        : [...prev.product_types, pt],
    }));
  };

  if (!isOpen) return null;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4 flex">
        {/* Main Form */}
        <div className={`flex-1 flex flex-col ${showClientPanel ? 'max-w-[60%]' : ''}`}>
          {/* Header */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
            <h2 className="text-base font-semibold">
              {isEditing ? `Edit ${request.request_number}` : 'New Request'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content - Scrollable */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Row 1: BU + Request Type */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Business Unit</label>
                <div className="flex flex-wrap gap-1">
                  {businessUnits?.map((bu) => (
                    <button
                      key={bu.id}
                      type="button"
                      onClick={() => updateField('business_unit_id', formData.business_unit_id === bu.id ? '' : bu.id)}
                      className={`px-2 py-1 rounded text-xs font-medium border ${
                        formData.business_unit_id === bu.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {bu.code || bu.name.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Request Type</label>
                <div className="flex gap-1">
                  {REQUEST_TYPES.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('request_type', value)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-xs font-medium ${
                        formData.request_type === value ? color : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Customer Search + Contact */}
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="flex gap-3">
                {/* Customer Search */}
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Customer</label>
                  {selectedClient ? (
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 bg-white border rounded cursor-pointer hover:bg-gray-50"
                      onClick={() => setShowClientPanel(true)}
                    >
                      <User className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium truncate">
                        {selectedClient.company_name || selectedClient.name}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search or enter new..."
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                      {clientResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
                          {clientResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectClient(c)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                            >
                              <div className="font-medium">{c.company_name || c.name}</div>
                              {c.primary_contact_phone && (
                                <div className="text-xs text-gray-500">{c.primary_contact_phone}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Contact Info */}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => updateField('contact_name', e.target.value)}
                    placeholder="Contact Name"
                    className="px-2 py-1.5 border rounded text-sm"
                  />
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => updateField('contact_phone', e.target.value)}
                    placeholder="Phone"
                    className="px-2 py-1.5 border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Address */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Job Address</label>
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
                placeholder="Enter job site address..."
              />
            </div>

            {/* Row 4: Product Types */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Product Types</label>
              <div className="flex flex-wrap gap-1">
                {PRODUCT_TYPES.map((pt) => {
                  const isSelected = formData.product_types.includes(pt);
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => toggleProductType(pt)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${
                        isSelected ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {pt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 5: Details Row */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => updateField('source', e.target.value as RequestSource)}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                >
                  <option value="phone">Phone</option>
                  <option value="web">Web</option>
                  <option value="referral">Referral</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="builder_portal">Builder</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Linear Feet</label>
                <input
                  type="number"
                  value={formData.linear_feet_estimate}
                  onChange={(e) => updateField('linear_feet_estimate', e.target.value)}
                  placeholder="Est."
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Territory</label>
                <select
                  value={formData.territory_id}
                  onChange={(e) => updateField('territory_id', e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                >
                  <option value="">Auto</option>
                  {territories?.filter(t => t.is_active).map((t) => (
                    <option key={t.id} value={t.id}>{t.code || t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assign Rep</label>
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

            {/* Row 6: Assessment + Priority */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="assessment"
                  checked={formData.requires_assessment}
                  onChange={(e) => updateField('requires_assessment', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="assessment" className="text-sm">Assessment</label>
                {formData.requires_assessment && (
                  <input
                    type="datetime-local"
                    value={formData.assessment_scheduled_at}
                    onChange={(e) => updateField('assessment_scheduled_at', e.target.value)}
                    className="px-2 py-1 border rounded text-xs ml-2"
                  />
                )}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-500">Priority:</span>
                {(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateField('priority', p)}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      formData.priority === p
                        ? p === 'urgent' ? 'bg-red-100 text-red-700'
                          : p === 'high' ? 'bg-orange-100 text-orange-700'
                          : p === 'normal' ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 7: Description */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description / Notes</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                placeholder="Project scope, requirements, internal notes..."
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="bg-gray-50 border-t px-4 py-2 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-gray-700 hover:bg-gray-200 rounded text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>

        {/* Client Info Side Panel */}
        {showClientPanel && selectedClient && (
          <div className="w-[40%] border-l bg-gray-50 flex flex-col">
            <div className="p-3 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-sm truncate">
                  {selectedClient.company_name || selectedClient.name}
                </span>
              </div>
              <button
                onClick={() => setShowClientPanel(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client Contact */}
            <div className="p-3 border-b text-xs">
              <div className="text-gray-500 mb-1">Contact</div>
              <div>{selectedClient.primary_contact_name || '-'}</div>
              <div className="text-gray-600">{selectedClient.primary_contact_phone}</div>
            </div>

            {/* Properties List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b bg-white sticky top-0">
                <div className="text-xs font-medium text-gray-500">PROPERTIES ({clientProperties?.length || 0})</div>
              </div>
              {clientProperties && clientProperties.length > 0 ? (
                <div className="p-2 space-y-1">
                  {clientProperties.map((prop) => (
                    <button
                      key={prop.id}
                      type="button"
                      onClick={() => handleSelectProperty(prop)}
                      className={`w-full p-2 rounded text-left text-xs ${
                        selectedPropertyId === prop.id
                          ? 'bg-blue-100 border-blue-300 border'
                          : 'bg-white border hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className={`w-3 h-3 mt-0.5 ${selectedPropertyId === prop.id ? 'text-blue-500' : 'text-gray-400'}`} />
                        <div>
                          <div className="font-medium">{prop.address_line1}</div>
                          <div className="text-gray-500">{prop.city}, {prop.state} {prop.zip}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-gray-500">
                  No properties found
                </div>
              )}
            </div>

            {/* New Address Option */}
            <div className="p-3 border-t bg-white">
              <button
                type="button"
                onClick={() => {
                  setSelectedPropertyId(null);
                  setFormData(prev => ({ ...prev, property_id: '', address_line1: '', city: '', zip: '' }));
                }}
                className={`w-full p-2 rounded text-xs text-center border ${
                  !selectedPropertyId && formData.address_line1 === ''
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                + Enter New Address
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
