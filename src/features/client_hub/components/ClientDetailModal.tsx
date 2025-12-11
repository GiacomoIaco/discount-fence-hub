import {
  X,
  Building2,
  Mail,
  Phone,
  MapPin,
  Home,
  Edit2,
  Plus,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { useClient, useCreateClientContact, useDeleteClientContact } from '../hooks/useClients';
import { useContactRoles } from '../hooks/useContacts';
import {
  BUSINESS_UNIT_LABELS,
  CLIENT_TYPE_LABELS,
  CLIENT_STATUS_LABELS,
} from '../types';
import { useState } from 'react';

interface Props {
  clientId: string;
  onClose: () => void;
  onEdit: () => void;
}

export default function ClientDetailModal({ clientId, onClose, onEdit }: Props) {
  const { data: client, isLoading } = useClient(clientId);
  const { data: contactRoles } = useContactRoles('client');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role_id: '', email: '', phone: '' });

  const createContactMutation = useCreateClientContact();
  const deleteContactMutation = useDeleteClientContact();

  const handleAddContact = async () => {
    if (!newContact.name.trim()) return;

    await createContactMutation.mutateAsync({
      client_id: clientId,
      name: newContact.name,
      role: null, // Legacy field - keep null
      role_id: newContact.role_id || null,
      email: newContact.email || null,
      phone: newContact.phone || null,
      is_primary: false,
      notes: null,
    });

    setNewContact({ name: '', role_id: '', email: '', phone: '' });
    setShowAddContact(false);
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

  if (!client) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{client.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {client.code && (
                  <span className="text-sm text-gray-500">{client.code}</span>
                )}
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                  {BUSINESS_UNIT_LABELS[client.business_unit]}
                </span>
                <span className="text-sm text-gray-500">
                  {CLIENT_TYPE_LABELS[client.client_type]}
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
          {/* Status & Info Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <span className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${
                client.status === 'active' ? 'bg-green-100 text-green-700' :
                client.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                client.status === 'prospect' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {CLIENT_STATUS_LABELS[client.status]}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Communities</div>
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-gray-400" />
                <span className="text-xl font-semibold text-gray-900">
                  {client.communities?.length || 0}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Payment Terms</div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <span className="text-xl font-semibold text-gray-900">
                  Net {client.payment_terms}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          {(client.primary_contact_name || client.primary_contact_email || client.primary_contact_phone) && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Primary Contact</h3>
              <div className="space-y-2">
                {client.primary_contact_name && (
                  <div className="font-medium text-gray-900">{client.primary_contact_name}</div>
                )}
                {client.primary_contact_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${client.primary_contact_email}`} className="hover:text-blue-600">
                      {client.primary_contact_email}
                    </a>
                  </div>
                )}
                {client.primary_contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${client.primary_contact_phone}`} className="hover:text-blue-600">
                      {client.primary_contact_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Address */}
          {(client.address_line1 || client.city) && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Address</h3>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5" />
                <div>
                  {client.address_line1 && <div>{client.address_line1}</div>}
                  {client.address_line2 && <div>{client.address_line2}</div>}
                  {(client.city || client.state || client.zip) && (
                    <div>
                      {client.city}{client.city && client.state ? ', ' : ''}{client.state} {client.zip}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Additional Contacts */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Additional Contacts</h3>
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

            {client.contacts && client.contacts.length > 0 ? (
              <div className="space-y-2">
                {client.contacts.map((contact) => {
                  // Get role label from joined contact_role or legacy role field
                  const roleLabel = contact.contact_role?.label || contact.role;
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{contact.name}</div>
                        <div className="text-sm text-gray-500">
                          {roleLabel && (
                            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                              {roleLabel}
                            </span>
                          )}
                          {contact.email && <span>{contact.email}</span>}
                          {contact.phone && <span> • {contact.phone}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteContactMutation.mutate({ id: contact.id, clientId })}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No additional contacts</p>
            )}
          </div>

          {/* Communities */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Communities</h3>
            {client.communities && client.communities.length > 0 ? (
              <div className="space-y-2">
                {client.communities.map((community: any) => (
                  <div
                    key={community.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Home className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{community.name}</div>
                        <div className="text-sm text-gray-500">
                          {community.geography?.name || 'No geography'}
                          {community.restrict_skus && (
                            <span className="ml-2 text-orange-600">
                              • {community.approved_sku_ids?.length || 0} SKUs restricted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      community.status === 'active' ? 'bg-green-100 text-green-700' :
                      community.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {community.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No communities yet</p>
            )}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
