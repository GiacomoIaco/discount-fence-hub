import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { showSuccess, showError } from '../../../../lib/toast';
import { SmartAddressInput } from '../../../../features/shared/components/SmartAddressInput';
import type { AddressFormData } from '../../../../features/shared/types/location';
import type { Client, ClientType, BusinessUnit } from '../../../../features/client_hub/types';

interface NewClientFormProps {
  initialName?: string;
  onSubmit: (client: Client) => void;
  onCancel: () => void;
}

const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: 'homeowner', label: 'Homeowner' },
  { value: 'large_builder', label: 'Large Builder' },
  { value: 'custom_builder', label: 'Custom Builder' },
  { value: 'landscaper', label: 'Landscaper' },
  { value: 'pool_company', label: 'Pool Company' },
  { value: 'other', label: 'Other' },
];

const BUSINESS_UNITS: { value: BusinessUnit; label: string }[] = [
  { value: 'residential', label: 'Residential' },
  { value: 'builders', label: 'Builders' },
  { value: 'commercial', label: 'Commercial' },
];

export function NewClientForm({ initialName = '', onSubmit, onCancel }: NewClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: initialName,
    client_type: 'homeowner' as ClientType,
    business_unit: 'residential' as BusinessUnit,
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_email: '',
    address_line1: '',
    city: '',
    state: 'TX',
    zip: '',
  });

  // Handler for SmartAddressInput
  const handleAddressChange = (address: AddressFormData) => {
    setForm((prev) => ({
      ...prev,
      address_line1: address.address_line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
    }));
  };

  // Update business_unit based on client_type
  const handleClientTypeChange = (type: ClientType) => {
    let businessUnit: BusinessUnit = 'residential';
    if (type === 'large_builder' || type === 'custom_builder') {
      businessUnit = 'builders';
    } else if (type === 'landscaper' || type === 'pool_company') {
      businessUnit = 'commercial';
    }
    setForm((prev) => ({
      ...prev,
      client_type: type,
      business_unit: businessUnit,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      showError('Client name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: form.name.trim(),
          client_type: form.client_type,
          business_unit: form.business_unit,
          primary_contact_name: form.primary_contact_name.trim() || null,
          primary_contact_phone: form.primary_contact_phone.trim() || null,
          primary_contact_email: form.primary_contact_email.trim() || null,
          address_line1: form.address_line1.trim() || null,
          city: form.city.trim() || null,
          state: form.state,
          zip: form.zip.trim() || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Client created successfully');
      onSubmit(data as Client);
    } catch (error: any) {
      console.error('Error creating client:', error);
      showError(error.message || 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Client Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Client Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter client name"
          autoFocus
        />
      </div>

      {/* Client Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Client Type
        </label>
        <select
          value={form.client_type}
          onChange={(e) => handleClientTypeChange(e.target.value as ClientType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CLIENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Business Unit (auto-set but editable) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Business Unit
        </label>
        <select
          value={form.business_unit}
          onChange={(e) => setForm((prev) => ({ ...prev, business_unit: e.target.value as BusinessUnit }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {BUSINESS_UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Contact Information</h3>
      </div>

      {/* Contact Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contact Name
        </label>
        <input
          type="text"
          value={form.primary_contact_name}
          onChange={(e) => setForm((prev) => ({ ...prev, primary_contact_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Primary contact name"
        />
      </div>

      {/* Phone & Email row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={form.primary_contact_phone}
            onChange={(e) => setForm((prev) => ({ ...prev, primary_contact_phone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="(512) 555-1234"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.primary_contact_email}
            onChange={(e) => setForm((prev) => ({ ...prev, primary_contact_email: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
      </div>

      {/* Address Section (optional) */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Address (Optional)</h3>
      </div>

      <SmartAddressInput
        value={{
          address_line1: form.address_line1,
          city: form.city,
          state: form.state,
          zip: form.zip,
          latitude: null,
          longitude: null,
        }}
        onChange={handleAddressChange}
        label=""
        restrictToTexas
        placeholder="Start typing address..."
      />

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Client
        </button>
      </div>
    </form>
  );
}
