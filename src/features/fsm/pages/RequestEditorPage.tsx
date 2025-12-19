/**
 * RequestEditorPage - Compact full page for creating/editing service requests
 *
 * Redesigned for R-007: Single-screen layout with client properties panel
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, AlertCircle, FileText, Wrench, Shield, Check, User, MapPin, Building2, ChevronRight, X } from 'lucide-react';
import { useCreateRequest, useUpdateRequest, useRequest } from '../hooks';
import { useTerritories, useSalesReps } from '../hooks';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';
import { useClientProperties } from '../../client_hub/hooks/useProperties';
import { SmartAddressInput } from '../../shared/components/SmartAddressInput';
import { supabase } from '../../../lib/supabase';
import type { AddressFormData } from '../../shared/types/location';
import type { RequestFormData, RequestSource, RequestType, Priority } from '../types';
import { PRODUCT_TYPES } from '../types';

interface RequestEditorPageProps {
  requestId?: string;
  onBack: () => void;
  onSaved?: (requestId: string) => void;
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

export default function RequestEditorPage({
  requestId,
  onBack,
  onSaved,
}: RequestEditorPageProps) {
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);

  // Client search state
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: existingRequest, isLoading: isLoadingRequest } = useRequest(requestId);
  const { data: territories } = useTerritories();
  const { data: salesReps } = useSalesReps();
  const { data: businessUnits } = useBusinessUnits();
  const { data: clientProperties } = useClientProperties(selectedClient?.id || null);

  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest();

  const isEditing = !!requestId;

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const filteredReps = useMemo(() => {
    if (!salesReps) return [];
    return salesReps.filter(r => r.is_active);
  }, [salesReps]);

  // Validate required fields
  const validateForm = useMemo(() => {
    const errors: string[] = [];
    const hasClient = !!formData.client_id;
    const hasContactName = !!formData.contact_name.trim();
    const hasContactMethod = !!formData.contact_phone.trim() || !!formData.contact_email.trim();

    if (!hasClient && !hasContactName) {
      errors.push('Customer name is required');
    }
    if (!hasClient && hasContactName && !hasContactMethod) {
      errors.push('Phone or email is required');
    }
    if (!formData.address_line1.trim()) {
      errors.push('Job address is required');
    }
    return errors;
  }, [formData.client_id, formData.contact_name, formData.contact_phone, formData.contact_email, formData.address_line1]);

  const isFormValid = validateForm.length === 0;

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

  // Load existing request data
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
      if (existingRequest.client) {
        // Cast to full client type since the join includes these fields
        const client = existingRequest.client as ClientSearchResult;
        setSelectedClient({
          id: client.id,
          name: client.name,
          company_name: client.company_name || null,
          primary_contact_name: client.primary_contact_name || null,
          primary_contact_phone: client.primary_contact_phone || null,
          primary_contact_email: client.primary_contact_email || null,
        });
      }
    }
  }, [existingRequest]);

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

  const handleSelectProperty = (property: { id: string; address_line1: string; city: string | null; state: string; zip: string | null; latitude: number | null; longitude: number | null }) => {
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
    setSelectedPropertyId(null);
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
    if (showValidationErrors) setShowValidationErrors(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setValidationErrors(validateForm);
      setShowValidationErrors(true);
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
        onBack();
        onSaved?.(result.id);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const updateField = <K extends keyof RequestFormData>(field: K, value: RequestFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (showValidationErrors) setShowValidationErrors(false);
  };

  const toggleProductType = (pt: string) => {
    setFormData(prev => ({
      ...prev,
      product_types: prev.product_types.includes(pt)
        ? prev.product_types.filter(p => p !== pt)
        : [...prev.product_types, pt],
    }));
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Form Area */}
      <div className={`flex-1 flex flex-col ${showClientPanel ? 'max-w-[70%]' : ''}`}>
        {/* Compact Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {isEditing ? `Edit ${existingRequest?.request_number || ''}` : 'New Service Request'}
              </h1>
              <p className="text-xs text-gray-500">{isEditing ? 'Update request details' : 'Create a new client service request'}</p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
          </button>
        </div>

        {/* Validation Errors */}
        {showValidationErrors && validationErrors.length > 0 && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-red-800">Fix errors: </span>
                <span className="text-red-700">{validationErrors.join(', ')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Form Content - All in one scrollable area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Row 1: BU + Request Type */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-2 block">BUSINESS UNIT</label>
                <div className="flex flex-wrap gap-1.5">
                  {businessUnits?.map((bu) => (
                    <button
                      key={bu.id}
                      type="button"
                      onClick={() => updateField('business_unit_id', formData.business_unit_id === bu.id ? '' : bu.id)}
                      className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                        formData.business_unit_id === bu.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {bu.code || bu.name.substring(0, 10)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-2 block">REQUEST TYPE</label>
                <div className="flex gap-2">
                  {REQUEST_TYPES.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('request_type', value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border text-xs font-medium transition-colors ${
                        formData.request_type === value ? color : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Customer + Contact */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex gap-4">
              {/* Customer Search */}
              <div className="w-1/3">
                <label className="text-xs font-medium text-gray-500 mb-2 block">CUSTOMER</label>
                {selectedClient ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => setShowClientPanel(true)}
                  >
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium truncate flex-1">
                      {selectedClient.company_name || selectedClient.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search or enter new..."
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                    {clientResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                        {clientResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectClient(c)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b last:border-b-0"
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
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">CONTACT NAME</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => updateField('contact_name', e.target.value)}
                    placeholder="Contact name"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">PHONE</label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => updateField('contact_phone', e.target.value)}
                    placeholder="512-555-1234"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">EMAIL</label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => updateField('contact_email', e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Address */}
          <div className="bg-white rounded-lg border p-4">
            <label className="text-xs font-medium text-gray-500 mb-2 block">JOB ADDRESS *</label>
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

          {/* Row 4: Product Types + Source + Linear Feet */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-2 block">PRODUCT TYPES (select all that apply)</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRODUCT_TYPES.map((pt) => {
                    const isSelected = formData.product_types.includes(pt);
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => toggleProductType(pt)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs transition-colors ${
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
              <div className="w-32">
                <label className="text-xs font-medium text-gray-500 mb-2 block">SOURCE</label>
                <select
                  value={formData.source}
                  onChange={(e) => updateField('source', e.target.value as RequestSource)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="phone">Phone</option>
                  <option value="web">Web</option>
                  <option value="referral">Referral</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="builder_portal">Builder</option>
                </select>
              </div>
              <div className="w-28">
                <label className="text-xs font-medium text-gray-500 mb-2 block">EST. LF</label>
                <input
                  type="number"
                  value={formData.linear_feet_estimate}
                  onChange={(e) => updateField('linear_feet_estimate', e.target.value)}
                  placeholder="150"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Assignment + Assessment + Priority */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex gap-4 items-end">
              <div className="w-40">
                <label className="text-xs font-medium text-gray-500 mb-2 block">TERRITORY</label>
                <select
                  value={formData.territory_id}
                  onChange={(e) => updateField('territory_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">Auto-detect</option>
                  {territories?.filter(t => t.is_active).map((t) => (
                    <option key={t.id} value={t.id}>{t.code || t.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-gray-500 mb-2 block">ASSIGN REP</label>
                <select
                  value={formData.assigned_rep_id}
                  onChange={(e) => updateField('assigned_rep_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">Unassigned</option>
                  {filteredReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 flex-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requires_assessment}
                    onChange={(e) => updateField('requires_assessment', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Assessment</span>
                </label>
                {formData.requires_assessment && (
                  <input
                    type="datetime-local"
                    value={formData.assessment_scheduled_at}
                    onChange={(e) => updateField('assessment_scheduled_at', e.target.value)}
                    className="px-2 py-1.5 border rounded text-xs"
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">Priority:</span>
                {(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateField('priority', p)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
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
          </div>

          {/* Row 6: Description + Notes */}
          <div className="flex gap-4">
            <div className="flex-1 bg-white rounded-lg border p-4">
              <label className="text-xs font-medium text-gray-500 mb-2 block">DESCRIPTION</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                placeholder="Project scope, requirements..."
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div className="w-1/3 bg-yellow-50 rounded-lg border border-yellow-200 p-4">
              <label className="text-xs font-medium text-gray-500 mb-2 block">INTERNAL NOTES</label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                placeholder="Notes for team only..."
                className="w-full px-3 py-2 border border-yellow-300 rounded text-sm bg-white"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Client Info Side Panel */}
      {showClientPanel && selectedClient && (
        <div className="w-[30%] min-w-[280px] border-l bg-gray-50 flex flex-col">
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-sm truncate">
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
          <div className="p-4 border-b text-sm">
            <div className="text-xs text-gray-500 mb-1">Contact</div>
            <div className="font-medium">{selectedClient.primary_contact_name || selectedClient.name}</div>
            <div className="text-gray-600">{selectedClient.primary_contact_phone}</div>
            {selectedClient.primary_contact_email && (
              <div className="text-gray-600 text-xs">{selectedClient.primary_contact_email}</div>
            )}
          </div>

          {/* Properties List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b bg-white sticky top-0">
              <div className="text-xs font-medium text-gray-500">PROPERTIES ({clientProperties?.length || 0})</div>
            </div>
            {clientProperties && clientProperties.length > 0 ? (
              <div className="p-3 space-y-2">
                {clientProperties.map((prop) => (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => handleSelectProperty(prop)}
                    className={`w-full p-3 rounded text-left text-sm ${
                      selectedPropertyId === prop.id
                        ? 'bg-blue-100 border-blue-300 border'
                        : 'bg-white border hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className={`w-4 h-4 mt-0.5 ${selectedPropertyId === prop.id ? 'text-blue-500' : 'text-gray-400'}`} />
                      <div>
                        <div className="font-medium">{prop.address_line1}</div>
                        <div className="text-gray-500 text-xs">{prop.city}, {prop.state} {prop.zip}</div>
                        {prop.community_name && (
                          <div className="text-gray-400 text-xs mt-0.5">{prop.community_name}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">
                No properties found for this client
              </div>
            )}
          </div>

          {/* New Address Option */}
          <div className="p-4 border-t bg-white">
            <button
              type="button"
              onClick={() => {
                setSelectedPropertyId(null);
                setFormData(prev => ({ ...prev, property_id: '', address_line1: '', city: '', zip: '' }));
              }}
              className={`w-full p-3 rounded text-sm text-center border ${
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
  );
}
