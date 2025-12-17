import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { showSuccess, showError } from '../../../../lib/toast';
import { SmartAddressInput } from '../../../../features/shared/components/SmartAddressInput';
import type { AddressFormData } from '../../../../features/shared/types/location';
import type { Property, Community, Client } from '../../../../features/client_hub/types';

interface NewPropertyFormProps {
  client: Client;
  communityId?: string;  // Pre-selected community
  initialAddress?: string;
  onSubmit: (property: Property) => void;
  onCancel: () => void;
}

export function NewPropertyForm({
  client,
  communityId,
  initialAddress = '',
  onSubmit,
  onCancel,
}: NewPropertyFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);

  const [form, setForm] = useState({
    community_id: communityId || '',
    address_line1: initialAddress,
    city: '',
    state: 'TX',
    zip: '',
    lot_number: '',
    block_number: '',
    gate_code: '',
    access_notes: '',
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    // Geocoding fields
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Handler for SmartAddressInput
  const handleAddressChange = (address: AddressFormData) => {
    setForm((prev) => ({
      ...prev,
      address_line1: address.address_line1,
      city: address.city,
      state: address.state,
      zip: address.zip,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
  };

  // Fetch communities for this client
  useEffect(() => {
    const fetchCommunities = async () => {
      setLoadingCommunities(true);
      try {
        const { data, error } = await supabase
          .from('communities')
          .select('*')
          .eq('client_id', client.id)
          .eq('status', 'active')
          .order('name');

        if (error) throw error;
        setCommunities(data || []);

        // Auto-select if only one community
        if (data && data.length === 1 && !communityId) {
          setForm((prev) => ({ ...prev, community_id: data[0].id }));
        }
      } catch (error) {
        console.error('Error fetching communities:', error);
      } finally {
        setLoadingCommunities(false);
      }
    };

    fetchCommunities();
  }, [client.id, communityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.address_line1.trim()) {
      showError('Address is required');
      return;
    }

    // For builder clients, community is required
    if (client.business_unit === 'builders' && !form.community_id) {
      showError('Please select a community');
      return;
    }

    // For non-builder clients without communities, we may need to create a default one
    let targetCommunityId = form.community_id;

    if (!targetCommunityId && communities.length === 0) {
      // Create a default community for residential/commercial clients
      try {
        const { data: newCommunity, error } = await supabase
          .from('communities')
          .insert({
            client_id: client.id,
            name: `${client.name} - Properties`,
            status: 'active',
          })
          .select()
          .single();

        if (error) throw error;
        targetCommunityId = newCommunity.id;
      } catch (error: any) {
        showError('Failed to create community: ' + error.message);
        return;
      }
    }

    if (!targetCommunityId) {
      showError('Please select a community');
      return;
    }

    setIsSubmitting(true);

    try {
      const hasCoordinates = form.latitude != null && form.longitude != null;

      const { data, error } = await supabase
        .from('properties')
        .insert({
          community_id: targetCommunityId,
          address_line1: form.address_line1.trim(),
          city: form.city.trim() || null,
          state: form.state,
          zip: form.zip.trim() || null,
          lot_number: form.lot_number.trim() || null,
          block_number: form.block_number.trim() || null,
          gate_code: form.gate_code.trim() || null,
          access_notes: form.access_notes.trim() || null,
          homeowner_name: form.homeowner_name.trim() || null,
          homeowner_phone: form.homeowner_phone.trim() || null,
          homeowner_email: form.homeowner_email.trim() || null,
          status: 'available',
          // Geocoding fields
          latitude: form.latitude,
          longitude: form.longitude,
          geocoded_at: hasCoordinates ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Property created successfully');
      onSubmit(data as Property);
    } catch (error: any) {
      console.error('Error creating property:', error);
      showError(error.message || 'Failed to create property');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBuilder = client.business_unit === 'builders';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Community selector (for builders with multiple communities) */}
      {(isBuilder || communities.length > 1) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Community {isBuilder && <span className="text-red-500">*</span>}
          </label>
          {loadingCommunities ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading communities...
            </div>
          ) : communities.length === 0 ? (
            <p className="text-sm text-gray-500">
              No communities found. A default will be created.
            </p>
          ) : (
            <select
              value={form.community_id}
              onChange={(e) => setForm((prev) => ({ ...prev, community_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a community...</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Lot/Block row (for builders) */}
      {isBuilder && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lot Number
            </label>
            <input
              type="text"
              value={form.lot_number}
              onChange={(e) => setForm((prev) => ({ ...prev, lot_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 123"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Block
            </label>
            <input
              type="text"
              value={form.block_number}
              onChange={(e) => setForm((prev) => ({ ...prev, block_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., A"
            />
          </div>
        </div>
      )}

      {/* Address */}
      <SmartAddressInput
        value={{
          address_line1: form.address_line1,
          city: form.city,
          state: form.state,
          zip: form.zip,
          latitude: form.latitude,
          longitude: form.longitude,
        }}
        onChange={handleAddressChange}
        label="Street Address"
        required
        restrictToTexas
        placeholder="Start typing address..."
      />

      {/* Site Access Section */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Site Access (Optional)</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gate Code
          </label>
          <input
            type="text"
            value={form.gate_code}
            onChange={(e) => setForm((prev) => ({ ...prev, gate_code: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., #1234"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Notes
          </label>
          <input
            type="text"
            value={form.access_notes}
            onChange={(e) => setForm((prev) => ({ ...prev, access_notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Enter through side gate"
          />
        </div>
      </div>

      {/* Homeowner Section (for residential or if homeowner exists) */}
      {!isBuilder && (
        <>
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Homeowner (Optional)</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Homeowner Name
            </label>
            <input
              type="text"
              value={form.homeowner_name}
              onChange={(e) => setForm((prev) => ({ ...prev, homeowner_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Smith"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.homeowner_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, homeowner_phone: e.target.value }))}
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
                value={form.homeowner_email}
                onChange={(e) => setForm((prev) => ({ ...prev, homeowner_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
              />
            </div>
          </div>
        </>
      )}

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
          Create Property
        </button>
      </div>
    </form>
  );
}
