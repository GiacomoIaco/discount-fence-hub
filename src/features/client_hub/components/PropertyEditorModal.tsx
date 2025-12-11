import { useState } from 'react';
import { X, MapPin, Key, User, Phone, Mail } from 'lucide-react';
import { useCreateProperty, useUpdateProperty } from '../hooks/useProperties';
import {
  PROPERTY_STATUS_LABELS,
  type Property,
  type PropertyFormData,
  type PropertyStatus,
} from '../types';

interface Props {
  property: Property | null;
  communityId: string;
  onClose: () => void;
}

export default function PropertyEditorModal({ property, communityId, onClose }: Props) {
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();

  const [formData, setFormData] = useState<PropertyFormData>({
    community_id: communityId,
    lot_number: property?.lot_number || '',
    block_number: property?.block_number || '',
    address_line1: property?.address_line1 || '',
    city: property?.city || '',
    state: property?.state || 'TX',
    zip: property?.zip || '',
    gate_code: property?.gate_code || '',
    access_notes: property?.access_notes || '',
    homeowner_name: property?.homeowner_name || '',
    homeowner_phone: property?.homeowner_phone || '',
    homeowner_email: property?.homeowner_email || '',
    status: property?.status || 'available',
    notes: property?.notes || '',
  });

  const isEditing = !!property;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.address_line1.trim()) {
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: property.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Property' : 'New Property'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Lot Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Lot Information</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                <input
                  type="text"
                  value={formData.lot_number}
                  onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  placeholder="42"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                <input
                  type="text"
                  value={formData.block_number}
                  onChange={(e) => setFormData({ ...formData, block_number: e.target.value })}
                  placeholder="A"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as PropertyStatus })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Address</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                placeholder="123 Main St"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Access Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              <Key className="w-4 h-4 inline mr-2" />
              Access Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gate Code</label>
                <input
                  type="text"
                  value={formData.gate_code}
                  onChange={(e) => setFormData({ ...formData, gate_code: e.target.value })}
                  placeholder="#1234"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Notes</label>
                <textarea
                  value={formData.access_notes}
                  onChange={(e) => setFormData({ ...formData, access_notes: e.target.value })}
                  rows={2}
                  placeholder="Enter through back gate, key under mat, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Homeowner Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              <User className="w-4 h-4 inline mr-2" />
              Homeowner Contact
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Homeowner Name</label>
                <input
                  type="text"
                  value={formData.homeowner_name}
                  onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-3 h-3 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.homeowner_phone}
                  onChange={(e) => setFormData({ ...formData, homeowner_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-3 h-3 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.homeowner_email}
                  onChange={(e) => setFormData({ ...formData, homeowner_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any additional notes about this property..."
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
            disabled={isPending || !formData.address_line1.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Property'}
          </button>
        </div>
      </div>
    </div>
  );
}
