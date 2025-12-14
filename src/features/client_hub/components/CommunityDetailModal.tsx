import { useState } from 'react';
import {
  X,
  Home,
  MapPin,
  Building2,
  Edit2,
  Plus,
  Trash2,
  Lock,
  Unlock,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import { useCommunity, useCreateCommunityContact, useDeleteCommunityContact, useUpdateCommunitySkus } from '../hooks/useCommunities';
import { useContactRoles } from '../hooks/useContacts';
import { COMMUNITY_STATUS_LABELS, type Property } from '../types';
import PropertiesList from './PropertiesList';
import PropertyEditorModal from './PropertyEditorModal';

interface Props {
  communityId: string;
  onClose: () => void;
  onEdit: () => void;
  /** Navigate to property detail page to see all jobs/quotes */
  onNavigateToProperty?: (propertyId: string) => void;
}

export default function CommunityDetailModal({ communityId, onClose, onEdit, onNavigateToProperty }: Props) {
  const { data: community, isLoading } = useCommunity(communityId);
  const { data: contactRoles } = useContactRoles('community');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role_id: '', email: '', phone: '' });
  const [showPropertyEditor, setShowPropertyEditor] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const createContactMutation = useCreateCommunityContact();
  const deleteContactMutation = useDeleteCommunityContact();
  const updateSkusMutation = useUpdateCommunitySkus();

  // Get default superintendent role ID
  const superintendentRole = contactRoles?.find(r => r.code === 'superintendent');

  const handleAddContact = async () => {
    if (!newContact.name.trim()) return;

    await createContactMutation.mutateAsync({
      community_id: communityId,
      name: newContact.name,
      role: null, // Legacy field - keep null
      role_id: newContact.role_id || superintendentRole?.id || null,
      email: newContact.email || null,
      phone: newContact.phone || null,
      is_primary: false,
      notes: null,
    });

    setNewContact({ name: '', role_id: '', email: '', phone: '' });
    setShowAddContact(false);
  };

  const handleToggleSkuRestriction = async () => {
    if (!community) return;

    await updateSkusMutation.mutateAsync({
      communityId,
      approved_sku_ids: community.approved_sku_ids || [],
      restrict_skus: !community.restrict_skus,
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!community) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Home className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{community.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {community.code && (
                  <span className="text-sm text-gray-500">{community.code}</span>
                )}
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  community.status === 'active' ? 'bg-green-100 text-green-700' :
                  community.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {COMMUNITY_STATUS_LABELS[community.status]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client & Geography */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Building2 className="w-4 h-4" />
                Client
              </div>
              <div className="font-medium text-gray-900">
                {(community as any).client?.name || 'Unknown'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <MapPin className="w-4 h-4" />
                Geography
              </div>
              <div className="font-medium text-gray-900">
                {(community as any).geography ? (
                  <>
                    {(community as any).geography.name}
                    <span className="text-sm text-gray-500 ml-2">
                      (${(community as any).geography.base_labor_rate}/hr)
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {(community.address_line1 || community.city) && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Location</h3>
              <div className="text-sm text-gray-600">
                {community.address_line1 && <div>{community.address_line1}</div>}
                {(community.city || community.state || community.zip) && (
                  <div>
                    {community.city}{community.city && community.state ? ', ' : ''}{community.state} {community.zip}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Properties */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <PropertiesList
              communityId={communityId}
              onAddProperty={() => {
                setSelectedProperty(null);
                setShowPropertyEditor(true);
              }}
              onSelectProperty={(property) => {
                setSelectedProperty(property);
                setShowPropertyEditor(true);
              }}
              onViewProperty={onNavigateToProperty ? (property) => {
                onNavigateToProperty(property.id);
              } : undefined}
            />
          </div>

          {/* SKU Restrictions */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">SKU Restrictions</h3>
              <button
                onClick={handleToggleSkuRestriction}
                disabled={updateSkusMutation.isPending}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  community.restrict_skus
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {community.restrict_skus ? (
                  <>
                    <Lock className="w-4 h-4" />
                    Restricted
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    All Allowed
                  </>
                )}
              </button>
            </div>

            {community.restrict_skus ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Only {community.approved_sku_ids?.length || 0} SKUs are approved for this community.
                </p>
                {community.approved_sku_ids && community.approved_sku_ids.length > 0 ? (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Approved SKU IDs:</p>
                    <div className="flex flex-wrap gap-2">
                      {community.approved_sku_ids.slice(0, 10).map((skuId) => (
                        <span
                          key={skuId}
                          className="px-2 py-1 text-xs bg-white border border-gray-200 rounded"
                        >
                          {skuId.substring(0, 8)}...
                        </span>
                      ))}
                      {community.approved_sku_ids.length > 10 && (
                        <span className="px-2 py-1 text-xs text-gray-500">
                          +{community.approved_sku_ids.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      No SKUs have been approved yet. Add SKUs to allow quoting for this community.
                    </p>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  SKU management will be available in the SKU Catalog integration (Phase 4)
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                All SKUs from the catalog are allowed for this community.
              </p>
            )}
          </div>

          {/* Contacts */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Contacts (Superintendents)</h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>

            {showAddContact && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <select
                    value={newContact.role_id}
                    onChange={(e) => setNewContact({ ...newContact, role_id: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select Role...</option>
                    {contactRoles?.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="email"
                    placeholder="Email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddContact(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContact}
                    disabled={!newContact.name.trim() || createContactMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createContactMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            {community.contacts && community.contacts.length > 0 ? (
              <div className="space-y-2">
                {community.contacts.map((contact) => {
                  // Get role label from joined contact_role or legacy role field
                  const roleLabel = (contact as any).contact_role?.label || contact.role;
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{contact.name}</div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {roleLabel && (
                              <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                {roleLabel}
                              </span>
                            )}
                            {contact.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {contact.phone}
                              </span>
                            )}
                            {contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteContactMutation.mutate({ id: contact.id, communityId })}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No contacts added yet</p>
            )}
          </div>

          {/* Notes */}
          {community.notes && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{community.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Property Editor Modal */}
      {showPropertyEditor && (
        <PropertyEditorModal
          property={selectedProperty}
          communityId={communityId}
          onClose={() => {
            setShowPropertyEditor(false);
            setSelectedProperty(null);
          }}
        />
      )}
    </div>
  );
}
