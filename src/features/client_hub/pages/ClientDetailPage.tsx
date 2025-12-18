import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Home,
  Edit2,
  Plus,
  Trash2,
  CreditCard,
  Briefcase,
  FileText,
  DollarSign,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useClient, useCreateClientContact, useDeleteClientContact } from '../hooks/useClients';
import { useContactRoles } from '../hooks/useContacts';
import { useRateSheet } from '../hooks/useRateSheets';
import {
  BUSINESS_UNIT_LABELS,
  CLIENT_TYPE_LABELS,
  CLIENT_STATUS_LABELS,
} from '../types';
import ClientEditorModal from '../components/ClientEditorModal';
import CustomFieldsSection from '../components/CustomFieldsSection';
import type { EntityType } from '../../../lib/routes';

type Tab = 'overview' | 'communities' | 'projects' | 'invoices';

interface ClientDetailPageProps {
  clientId: string;
  onBack: () => void;
  /** Initial tab from URL (e.g., /clients/:id/projects) */
  initialTab?: Tab;
  /** Called when tab changes - for URL updates */
  onTabChange?: (tab: Tab) => void;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
}

export default function ClientDetailPage({
  clientId,
  onBack,
  initialTab = 'overview',
  onTabChange,
  onNavigateToEntity,
}: ClientDetailPageProps) {
  const { data: client, isLoading } = useClient(clientId);
  const { data: contactRoles } = useContactRoles('client');
  const { data: rateSheet } = useRateSheet(client?.default_rate_sheet_id || null);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role_id: '', email: '', phone: '' });

  const createContactMutation = useCreateClientContact();
  const deleteContactMutation = useDeleteClientContact();

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleCommunityClick = (communityId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('community', { id: communityId, clientId });
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim()) return;

    await createContactMutation.mutateAsync({
      client_id: clientId,
      name: newContact.name,
      role: null,
      role_id: newContact.role_id || null,
      email: newContact.email || null,
      phone: newContact.phone || null,
      is_primary: false,
      notes: null,
    });

    setNewContact({ name: '', role_id: '', email: '', phone: '' });
    setShowAddContact(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
    { id: 'communities', label: 'Communities', icon: <Home className="w-4 h-4" />, count: client?.communities?.length },
    { id: 'projects', label: 'Projects', icon: <Briefcase className="w-4 h-4" />, count: 0 }, // TODO: Add project count
    { id: 'invoices', label: 'Invoices', icon: <FileText className="w-4 h-4" />, count: 0 }, // TODO: Add invoice count
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">Client not found</h2>
          <p className="text-gray-500 mt-1">The client you're looking for doesn't exist.</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Navigation Bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            <Building2 className="w-4 h-4" />
            Client Hub
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700 font-medium truncate max-w-xs">
            {client?.company_name || client?.name || 'Loading...'}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-10 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Back to Client Hub"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {client.company_name || client.name}
                  </h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    client.status === 'active' ? 'bg-green-100 text-green-700' :
                    client.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                    client.status === 'prospect' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  {client.code && <span className="font-mono">{client.code}</span>}
                  <span>•</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                    {client.qbo_class_name || BUSINESS_UNIT_LABELS[client.business_unit] || 'No BU'}
                  </span>
                  <span>•</span>
                  <span>{CLIENT_TYPE_LABELS[client.client_type]}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {client.quickbooks_id && (
                <a
                  href={`https://app.qbo.intuit.com/app/customerdetail?nameId=${client.quickbooks_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                  View in QBO
                </a>
              )}
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit2 className="w-4 h-4" />
                Edit Client
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex gap-6 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-6xl mx-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Communities</div>
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold text-gray-900">
                    {client.communities?.length || 0}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Active Projects</div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold text-gray-900">0</span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Open Invoices</div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold text-gray-900">0</span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Payment Terms</div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  <span className="text-2xl font-bold text-gray-900">
                    Net {client.payment_terms}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Primary Contact */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Primary Contact</h3>
                  {(() => {
                    // For companies: `name` is the contact (new model), fallback to primary_contact_name (old data)
                    // For individuals: primary_contact_name OR name (both work as client/contact name)
                    const contactName = client.company_name
                      ? (client.name || client.primary_contact_name)
                      : (client.primary_contact_name || client.name);

                    if (!contactName && !client.primary_contact_email && !client.primary_contact_phone) {
                      return <p className="text-gray-500">No primary contact set</p>;
                    }

                    return (
                      <div className="space-y-3">
                        {contactName && (
                          <div className="font-medium text-gray-900 text-lg">
                            {contactName}
                          </div>
                        )}
                        {client.primary_contact_email && (
                          <a
                            href={`mailto:${client.primary_contact_email}`}
                            className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
                          >
                            <Mail className="w-4 h-4" />
                            {client.primary_contact_email}
                          </a>
                        )}
                        {client.primary_contact_phone && (
                          <a
                            href={`tel:${client.primary_contact_phone}`}
                            className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
                          >
                            <Phone className="w-4 h-4" />
                            {client.primary_contact_phone}
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Address */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Address</h3>
                  {client.address_line1 || client.city ? (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="text-gray-600">
                        {client.address_line1 && <div>{client.address_line1}</div>}
                        {client.address_line2 && <div>{client.address_line2}</div>}
                        {(client.city || client.state || client.zip) && (
                          <div>
                            {client.city}{client.city && client.state ? ', ' : ''}{client.state} {client.zip}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No address on file</p>
                  )}
                </div>

                {/* Rate Sheet / Pricing */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Pricing</h3>
                  </div>
                  {rateSheet ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{rateSheet.name}</div>
                          <div className="text-sm text-gray-500">
                            {rateSheet.code && <span className="mr-2">{rateSheet.code}</span>}
                            {rateSheet.pricing_type === 'custom' && 'Custom Prices'}
                            {rateSheet.pricing_type === 'formula' && 'Formula-Based'}
                            {rateSheet.pricing_type === 'hybrid' && 'Hybrid'}
                          </div>
                        </div>
                      </div>
                      {rateSheet.description && (
                        <p className="text-sm text-gray-600">{rateSheet.description}</p>
                      )}
                      <div className="text-xs text-gray-400">
                        Effective: {new Date(rateSheet.effective_date).toLocaleDateString()}
                        {rateSheet.expires_at && (
                          <span> • Expires: {new Date(rateSheet.expires_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">
                      <p>No rate sheet assigned</p>
                      <p className="text-xs text-gray-400 mt-1">Default pricing will be used</p>
                    </div>
                  )}
                </div>

                {/* Invoice Summary - Placeholder until we have invoice data */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Invoice Summary</h3>
                    <button
                      onClick={() => handleTabChange('invoices')}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      View All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">Total Invoiced</div>
                      <div className="text-lg font-semibold text-gray-900">$0.00</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">Balance Due</div>
                      <div className="text-lg font-semibold text-gray-900">$0.00</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Invoice tracking coming soon</p>
                </div>

                {/* Notes */}
                {client.notes && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Additional Contacts */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Additional Contacts</h3>
                    <button
                      onClick={() => setShowAddContact(!showAddContact)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Contact
                    </button>
                  </div>

                  {showAddContact && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
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
                    <p className="text-gray-500 text-sm">No additional contacts</p>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                      <Plus className="w-5 h-5 text-blue-500" />
                      <span>Create New Project</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                      <Home className="w-5 h-5 text-green-500" />
                      <span>Add Community</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                      <DollarSign className="w-5 h-5 text-orange-500" />
                      <span>Create Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Custom Fields */}
                <CustomFieldsSection
                  entityType="client"
                  entityId={clientId}
                  collapsible={true}
                  defaultCollapsed={false}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'communities' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Communities</h3>
              <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" />
                Add Community
              </button>
            </div>
            {client.communities && client.communities.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {client.communities.map((community: any) => (
                  <div
                    key={community.id}
                    onClick={() => handleCommunityClick(community.id)}
                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <Home className="w-5 h-5 text-green-600" />
                      </div>
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
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        community.status === 'active' ? 'bg-green-100 text-green-700' :
                        community.status === 'onboarding' ? 'bg-blue-100 text-blue-700' :
                        community.status === 'new' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {community.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No communities yet</p>
                <button className="mt-3 text-blue-600 hover:text-blue-700 text-sm">
                  Add your first community
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Projects coming soon</h3>
            <p className="text-gray-500 mt-1">
              This tab will show all projects associated with this client.
            </p>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Invoices coming soon</h3>
            <p className="text-gray-500 mt-1">
              This tab will show all invoices for this client with payment status.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditor && (
        <ClientEditorModal
          client={client}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
