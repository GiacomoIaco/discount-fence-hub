/**
 * RequestEditorPage - Workiz-style layout for service requests
 *
 * R-007: Two-column layout with Client Details (left) and Service Location (right)
 * Fixed-width center content that slides left when sidebar opens
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Save, AlertCircle, FileText, Wrench, Shield, Check, X, MapPin, Building2, Calendar, Clock } from 'lucide-react';
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
  address_line2: '',
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

  // Merged client name/search field - type to search, if no match it becomes new client
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // Merged company name/search field - same pattern
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [companyResults, setCompanyResults] = useState<ClientSearchResult[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);

  // Client panel and property selection
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Schedule state (separate date/time like Jobber)
  const [scheduleDate, setScheduleDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [scheduleLater, setScheduleLater] = useState(true); // Schedule later checkbox
  const [anytime, setAnytime] = useState(false); // Anytime checkbox (no specific time)

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

  // Auto-detect matching territories from ZIP (supports overlapping territories)
  const matchingTerritories = useMemo(() => {
    if (!formData.zip || !territories) return [];
    return territories.filter(t => {
      const hasZip = t.zip_codes?.some(z => z.trim() === formData.zip.trim());
      const matchesBU = !formData.business_unit_id || t.business_unit_id === formData.business_unit_id;
      return hasZip && matchesBU && t.is_active;
    });
  }, [formData.zip, formData.business_unit_id, territories]);

  // Validate required fields
  const validateForm = useMemo(() => {
    const errors: string[] = [];
    const hasClient = !!formData.client_id;
    const hasContactName = !!clientNameInput.trim();
    const hasContactMethod = !!formData.contact_phone.trim() || !!formData.contact_email.trim();

    if (!hasClient && !hasContactName) {
      errors.push('Client name is required');
    }
    if (!hasClient && hasContactName && !hasContactMethod) {
      errors.push('Phone or email is required');
    }
    if (!formData.address_line1.trim()) {
      errors.push('Service location is required');
    }
    return errors;
  }, [formData.client_id, clientNameInput, formData.contact_phone, formData.contact_email, formData.address_line1]);

  const isFormValid = validateForm.length === 0;

  // Search clients by name (merged search)
  useEffect(() => {
    if (selectedClient || clientNameInput.length < 2) {
      setClientResults([]);
      return;
    }
    const search = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, company_name, primary_contact_name, primary_contact_phone, primary_contact_email')
        .or(`name.ilike.%${clientNameInput}%,primary_contact_name.ilike.%${clientNameInput}%,primary_contact_phone.ilike.%${clientNameInput}%`)
        .limit(5);
      setClientResults(data || []);
      setShowClientDropdown((data?.length || 0) > 0);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [clientNameInput, selectedClient]);

  // Search companies (merged search)
  useEffect(() => {
    if (selectedClient || companyNameInput.length < 2) {
      setCompanyResults([]);
      return;
    }
    const search = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, company_name, primary_contact_name, primary_contact_phone, primary_contact_email')
        .not('company_name', 'is', null)
        .ilike('company_name', `%${companyNameInput}%`)
        .limit(5);
      setCompanyResults(data || []);
      setShowCompanyDropdown((data?.length || 0) > 0);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [companyNameInput, selectedClient]);

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
        address_line2: existingRequest.address_line2 || '',
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
      setClientNameInput(existingRequest.contact_name || '');
      if (existingRequest.client) {
        const client = existingRequest.client as ClientSearchResult;
        setSelectedClient({
          id: client.id,
          name: client.name,
          company_name: client.company_name || null,
          primary_contact_name: client.primary_contact_name || null,
          primary_contact_phone: client.primary_contact_phone || null,
          primary_contact_email: client.primary_contact_email || null,
        });
        setCompanyNameInput(client.company_name || '');
        setClientNameInput(client.primary_contact_name || client.name || '');
      }
    }
  }, [existingRequest]);

  // Auto-set first matching territory for backwards compatibility
  useEffect(() => {
    if (matchingTerritories.length > 0) {
      setFormData(prev => ({ ...prev, territory_id: matchingTerritories[0].id }));
    } else if (formData.zip) {
      setFormData(prev => ({ ...prev, territory_id: '' }));
    }
  }, [matchingTerritories]);

  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setCompanyNameInput(client.company_name || '');
    setClientNameInput(client.primary_contact_name || client.name);
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      contact_name: client.primary_contact_name || client.name,
      contact_phone: client.primary_contact_phone || '',
      contact_email: client.primary_contact_email || '',
    }));
    setClientResults([]);
    setCompanyResults([]);
    setShowClientDropdown(false);
    setShowCompanyDropdown(false);
    setShowClientPanel(true);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setCompanyNameInput('');
    setClientNameInput('');
    setFormData(prev => ({
      ...prev,
      client_id: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
    }));
    setShowClientPanel(false);
  };

  // Handle address change from SmartAddressInput
  const handleAddressChange = (address: AddressFormData) => {
    setSelectedPropertyId(null);
    setFormData(prev => ({
      ...prev,
      property_id: '',
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
    if (showValidationErrors) setShowValidationErrors(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build assessment_scheduled_at from date/time fields
    let assessmentDateTime = '';
    if (!scheduleLater && scheduleDate) {
      if (anytime || !startTime) {
        // Just the date, no specific time
        assessmentDateTime = scheduleDate;
      } else {
        // Combine date + time
        assessmentDateTime = `${scheduleDate}T${startTime}`;
      }
    }

    // Sync client name/company to contact_name
    const dataToSave = {
      ...formData,
      contact_name: companyNameInput ? clientNameInput : (clientNameInput || formData.contact_name),
      assessment_scheduled_at: assessmentDateTime,
    };

    if (!isFormValid) {
      setValidationErrors(validateForm);
      setShowValidationErrors(true);
      return;
    }
    setShowValidationErrors(false);
    try {
      if (isEditing && requestId) {
        await updateMutation.mutateAsync({ id: requestId, data: dataToSave });
        onSaved?.(requestId);
        onBack();
      } else {
        const result = await createMutation.mutateAsync(dataToSave);
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading request...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {isEditing ? `Edit ${existingRequest?.request_number || ''}` : 'New Service Request'}
            </h1>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Create Request'}
        </button>
      </div>

      {/* Validation Errors */}
      {showValidationErrors && validationErrors.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-red-800">Fix errors: </span>
                <span className="text-red-700">{validationErrors.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Fixed width, slides left when sidebar opens */}
      <div className="flex justify-center">
        <div className={`transition-all duration-300 ${showClientPanel ? 'mr-80' : ''}`}>
          <form onSubmit={handleSubmit} className="max-w-6xl mx-auto p-4 space-y-4">
            {/* Row 1: Client Details (left) + Service Location (right) - Workiz style */}
            <div className="grid grid-cols-2 gap-4">
              {/* Client Details Card */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Client Details</h2>

                <div className="space-y-3">
                  {/* Selected Client Badge (when client is selected) */}
                  {selectedClient && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {selectedClient.company_name || selectedClient.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearClient}
                        className="p-1 hover:bg-blue-100 rounded"
                        title="Change client"
                      >
                        <X className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClientPanel(true)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View Properties
                      </button>
                    </div>
                  )}

                  {/* Client Name - Merged search/input field */}
                  <div className="relative">
                    <input
                      ref={clientInputRef}
                      type="text"
                      value={clientNameInput}
                      onChange={(e) => {
                        setClientNameInput(e.target.value);
                        setFormData(prev => ({ ...prev, contact_name: e.target.value }));
                        if (selectedClient) {
                          handleClearClient(); // Clear selection if user types
                        }
                      }}
                      onFocus={() => clientResults.length > 0 && setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                      placeholder="Client name (type to search existing)"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      disabled={!!selectedClient}
                    />
                    {showClientDropdown && clientResults.length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clientResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectClient(c)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b last:border-b-0"
                          >
                            <div className="font-medium">{c.primary_contact_name || c.name}</div>
                            {c.primary_contact_phone && (
                              <div className="text-xs text-gray-500">{c.primary_contact_phone}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Company Name - Merged search/input field */}
                  <div className="relative">
                    <input
                      ref={companyInputRef}
                      type="text"
                      value={companyNameInput}
                      onChange={(e) => {
                        setCompanyNameInput(e.target.value);
                        if (selectedClient) {
                          handleClearClient(); // Clear selection if user types
                        }
                      }}
                      onFocus={() => companyResults.length > 0 && setShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                      placeholder="Company name (optional, type to search)"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      disabled={!!selectedClient}
                    />
                    {showCompanyDropdown && companyResults.length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {companyResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectClient(c)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b last:border-b-0"
                          >
                            <div className="font-medium">{c.company_name}</div>
                            <div className="text-xs text-gray-500">{c.primary_contact_name || c.name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone + Email */}
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => updateField('contact_phone', e.target.value)}
                      placeholder="Phone"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => updateField('contact_email', e.target.value)}
                      placeholder="Email"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Source dropdown */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => updateField('source', e.target.value as RequestSource)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="phone">Phone</option>
                      <option value="web">Web</option>
                      <option value="referral">Referral</option>
                      <option value="walk_in">Walk-in</option>
                      <option value="builder_portal">Builder</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Service Location Card */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Service Location</h2>
                <div className="space-y-3">
                  {/* Street Address - Smart autocomplete with Unit/Suite + City/State/ZIP */}
                  <SmartAddressInput
                    value={{
                      address_line1: formData.address_line1,
                      address_line2: formData.address_line2,
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
                    placeholder="Street address"
                  />

                  {/* Territory - auto-detected from ZIP (supports overlapping) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Territory</label>
                    {matchingTerritories.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {matchingTerritories.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            {t.name} ({t.code})
                          </span>
                        ))}
                      </div>
                    ) : formData.zip ? (
                      <span className="text-sm text-amber-600">No territory covers ZIP {formData.zip}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Enter ZIP to auto-detect</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Job Details (left) + Scheduling (right) - Workiz style */}
            <div className="grid grid-cols-2 gap-4">
              {/* Job Details Card */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Job Details</h2>

                <div className="space-y-3">
                  {/* Business Unit */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Business Unit</label>
                    <div className="flex flex-wrap gap-1">
                      {businessUnits?.map((bu) => (
                        <button
                          key={bu.id}
                          type="button"
                          onClick={() => updateField('business_unit_id', formData.business_unit_id === bu.id ? '' : bu.id)}
                          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                            formData.business_unit_id === bu.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {bu.code || bu.name.substring(0, 8)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Request Type */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Request Type</label>
                    <div className="flex gap-2">
                      {REQUEST_TYPES.map(({ value, label, icon: Icon, color }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateField('request_type', value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border text-sm font-medium transition-colors ${
                            formData.request_type === value ? color : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
                    <label className="block text-xs text-gray-500 mb-1">Product Types</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRODUCT_TYPES.map((pt) => {
                        const isSelected = formData.product_types.includes(pt);
                        return (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => toggleProductType(pt)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs border transition-colors ${
                              isSelected ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            {pt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Job Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={3}
                      placeholder="Job description"
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling Card */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Schedule</h2>

                <div className="space-y-4">
                  {/* Date + Time Row (like Jobber) */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => {
                          setScheduleDate(e.target.value);
                          if (e.target.value) setScheduleLater(false);
                        }}
                        disabled={scheduleLater}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${scheduleLater ? 'bg-gray-50 text-gray-400' : ''}`}
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">Start time</label>
                      <div className="relative">
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          disabled={scheduleLater || anytime}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${(scheduleLater || anytime) ? 'bg-gray-50 text-gray-400' : ''}`}
                        />
                        <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">End time</label>
                      <div className="relative">
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          disabled={scheduleLater || anytime}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${(scheduleLater || anytime) ? 'bg-gray-50 text-gray-400' : ''}`}
                        />
                        <Clock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Schedule Later + Anytime checkboxes (like Jobber) */}
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleLater}
                        onChange={(e) => {
                          setScheduleLater(e.target.checked);
                          if (e.target.checked) {
                            setScheduleDate('');
                            setStartTime('');
                            setEndTime('');
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-600">Schedule later</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={anytime}
                        onChange={(e) => {
                          setAnytime(e.target.checked);
                          if (e.target.checked) {
                            setStartTime('');
                            setEndTime('');
                          }
                        }}
                        disabled={scheduleLater}
                        className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                      />
                      <span className={`text-sm ${scheduleLater ? 'text-gray-400' : 'text-gray-600'}`}>Anytime</span>
                    </label>
                  </div>

                  {/* Assign Rep */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Assign team member</label>
                    <select
                      value={formData.assigned_rep_id}
                      onChange={(e) => updateField('assigned_rep_id', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Unassigned</option>
                      {filteredReps.map((rep) => (
                        <option key={rep.id} value={rep.id}>{rep.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Priority</label>
                    <div className="flex gap-1">
                      {(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateField('priority', p)}
                          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
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

                  {/* View Schedule button */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <Calendar className="w-4 h-4" />
                    View schedule
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Internal Notes */}
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Internal Notes</h2>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={2}
                placeholder="Notes for internal team only (not visible to customer)..."
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm bg-white resize-none"
              />
            </div>
          </form>
        </div>

        {/* Client Properties Side Panel - Fixed right */}
        {showClientPanel && selectedClient && (
          <div className="fixed right-0 top-0 h-full w-80 bg-white border-l shadow-lg z-10 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-sm truncate">
                  {selectedClient.company_name || selectedClient.name}
                </span>
              </div>
              <button
                onClick={() => setShowClientPanel(false)}
                className="p-1 hover:bg-gray-200 rounded"
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
              <div className="p-4 border-b bg-gray-50 sticky top-0">
                <div className="text-xs font-medium text-gray-500">PROPERTIES ({clientProperties?.length || 0})</div>
              </div>
              {clientProperties && clientProperties.length > 0 ? (
                <div className="p-3 space-y-2">
                  {clientProperties.map((prop) => (
                    <button
                      key={prop.id}
                      type="button"
                      onClick={() => handleSelectProperty(prop)}
                      className={`w-full p-3 rounded-lg text-left text-sm ${
                        selectedPropertyId === prop.id
                          ? 'bg-blue-100 border-blue-300 border'
                          : 'bg-gray-50 border hover:border-blue-300'
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
            <div className="p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setSelectedPropertyId(null);
                  setFormData(prev => ({ ...prev, property_id: '', address_line1: '', city: '', zip: '' }));
                }}
                className={`w-full p-3 rounded-lg text-sm text-center border ${
                  !selectedPropertyId && formData.address_line1 === ''
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'hover:bg-white text-gray-600'
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
