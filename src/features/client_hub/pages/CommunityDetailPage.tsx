/**
 * CommunityDetailPage - Full page view of a community
 *
 * Shows all information for a specific community:
 * - Community info (name, status, dates, geography)
 * - Contacts (superintendents)
 * - Projects for this community
 * - SKU restrictions
 *
 * Accessible via URL: /clients/:clientId/communities/:id
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Home,
  Building2,
  MapPin,
  Calendar,
  User,
  Users,
  Phone,
  Mail,
  Edit2,
  Plus,
  Trash2,
  Briefcase,
  Lock,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useCommunity, useUpdateCommunity, useCreateCommunityContact, useDeleteCommunityContact } from '../hooks/useCommunities';
import { useContactRoles } from '../hooks/useContacts';
import { COMMUNITY_STATUS_LABELS, type CommunityStatus } from '../types';
import CommunityEditorModal from '../components/CommunityEditorModal';
import CustomFieldsSection from '../components/CustomFieldsSection';
import type { EntityType } from '../../../lib/routes';

type Tab = 'overview' | 'projects' | 'contacts' | 'skus';

interface CommunityDetailPageProps {
  communityId: string;
  clientId: string;
  onBack: () => void;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
}

export default function CommunityDetailPage({
  communityId,
  clientId,
  onBack,
  onNavigateToEntity,
}: CommunityDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showEditor, setShowEditor] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role_id: '', email: '', phone: '' });

  const { data: community, isLoading } = useCommunity(communityId);
  const { data: contactRoles } = useContactRoles('community');
  const updateCommunity = useUpdateCommunity();
  const createContactMutation = useCreateCommunityContact();
  const deleteContactMutation = useDeleteCommunityContact();

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim()) return;

    await createContactMutation.mutateAsync({
      community_id: communityId,
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

  const handleStatusChange = async (newStatus: CommunityStatus) => {
    await updateCommunity.mutateAsync({
      id: communityId,
      data: { status: newStatus },
    });
  };

  const handleNavigateToClient = () => {
    if (onNavigateToEntity && community?.client_id) {
      onNavigateToEntity('client', { id: community.client_id });
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <Briefcase className="w-4 h-4" />, count: 0 }, // TODO: Add project count
    { id: 'contacts', label: 'Contacts', icon: <Users className="w-4 h-4" />, count: community?.contacts?.length },
    { id: 'skus', label: 'SKUs', icon: <Lock className="w-4 h-4" />, count: community?.restrict_skus ? community.approved_sku_ids?.length : undefined },
  ];

  const statusColors: Record<CommunityStatus, string> = {
    new: 'bg-gray-100 text-gray-700',
    onboarding: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    completed: 'bg-purple-100 text-purple-700',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">Community not found</h2>
          <p className="text-gray-500 mt-1">The community you're looking for doesn't exist.</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Client Hub
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
          <button
            onClick={handleNavigateToClient}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium truncate max-w-xs"
          >
            {community.client?.name || 'Client'}
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700 font-medium truncate max-w-xs">
            {community.name}
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
              <div className="p-3 bg-green-100 rounded-xl">
                <Home className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{community.name}</h1>
                  <select
                    value={community.status}
                    onChange={(e) => handleStatusChange(e.target.value as CommunityStatus)}
                    className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${statusColors[community.status]}`}
                  >
                    {Object.entries(COMMUNITY_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  {community.code && <span className="font-mono">{community.code}</span>}
                  {community.code && community.client && <span>•</span>}
                  {community.client && (
                    <button
                      onClick={handleNavigateToClient}
                      className="text-blue-600 hover:underline"
                    >
                      {community.client.name}
                    </button>
                  )}
                  {community.geography && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {community.geography.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Edit2 className="w-4 h-4" />
                Edit Community
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
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600'
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
                <div className="text-sm text-gray-500 mb-1">Projects</div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold text-gray-900">0</span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Contacts</div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold text-gray-900">
                    {community.contacts?.length || 0}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Start Date</div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-500" />
                  <span className="text-lg font-bold text-gray-900">
                    {formatDate(community.start_date)}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">End Date</div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-red-500" />
                  <span className="text-lg font-bold text-gray-900">
                    {formatDate(community.end_date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Location */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
                  {community.address_line1 || community.city ? (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="text-gray-600">
                        {community.address_line1 && <div>{community.address_line1}</div>}
                        {(community.city || community.state || community.zip) && (
                          <div>
                            {community.city}{community.city && community.state ? ', ' : ''}{community.state} {community.zip}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No address on file</p>
                  )}

                  {community.geography && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-sm text-gray-500 mb-1">Labor Zone</div>
                      <div className="font-medium text-gray-900">{community.geography.name}</div>
                      {community.geography.base_labor_rate && (
                        <div className="text-sm text-gray-500">
                          Base rate: ${community.geography.base_labor_rate}/hr
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Assignments */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignments</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Default Sales Rep</div>
                      {community.default_rep ? (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{community.default_rep.display_name || community.default_rep.email}</span>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">Not assigned</p>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Priority Crews</div>
                      {community.priority_crew_ids && community.priority_crew_ids.length > 0 ? (
                        <div className="text-sm text-gray-900">
                          {community.priority_crew_ids.length} crew(s) assigned
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">None assigned</p>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Priority Project Managers</div>
                      {community.priority_pm_ids && community.priority_pm_ids.length > 0 ? (
                        <div className="text-sm text-gray-900">
                          {community.priority_pm_ids.length} PM(s) assigned
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">None assigned</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {community.notes && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{community.notes}</p>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Client Info */}
                {community.client && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Client</h3>
                    <button
                      onClick={handleNavigateToClient}
                      className="w-full flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{community.client.name}</div>
                        {community.client.code && (
                          <div className="text-sm text-gray-500 font-mono">{community.client.code}</div>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                    </button>
                  </div>
                )}

                {/* SKU Restrictions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">SKU Restrictions</h3>
                  {community.restrict_skus ? (
                    <div>
                      <div className="flex items-center gap-2 text-orange-600 mb-2">
                        <Lock className="w-4 h-4" />
                        <span className="font-medium">Restricted</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {community.approved_sku_ids?.length || 0} SKUs approved for this community
                      </p>
                      <button
                        onClick={() => setActiveTab('skus')}
                        className="mt-3 text-sm text-blue-600 hover:underline"
                      >
                        Manage SKUs
                      </button>
                    </div>
                  ) : (
                    <div className="text-gray-600">
                      <p className="mb-1">All SKUs are allowed</p>
                      <p className="text-sm text-gray-500">
                        No restrictions applied to this community
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                      <Plus className="w-5 h-5 text-green-500" />
                      <span>Create New Project</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                      <Users className="w-5 h-5 text-blue-500" />
                      <span>Add Contact</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                      <FileText className="w-5 h-5 text-orange-500" />
                      <span>View Rate Sheet</span>
                    </button>
                  </div>
                </div>

                {/* Custom Fields */}
                <CustomFieldsSection
                  entityType="community"
                  entityId={communityId}
                  collapsible={true}
                  defaultCollapsed={false}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Projects coming soon</h3>
            <p className="text-gray-500 mt-1">
              This tab will show all projects for this community.
            </p>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Contacts</h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>

            {showAddContact && (
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-3 mb-3">
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
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {createContactMutation.isPending ? 'Adding...' : 'Add Contact'}
                  </button>
                </div>
              </div>
            )}

            {community.contacts && community.contacts.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {community.contacts.map((contact) => {
                  const roleLabel = contact.contact_role?.label || contact.role;
                  return (
                    <div
                      key={contact.id}
                      className="p-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{contact.name}</div>
                          <div className="text-sm text-gray-500">
                            {roleLabel && (
                              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                                {roleLabel}
                              </span>
                            )}
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                                {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <>
                                {contact.email && ' • '}
                                <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                                  {contact.phone}
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteContactMutation.mutate({ id: contact.id, communityId })}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No contacts yet</p>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="mt-3 text-green-600 hover:text-green-700 text-sm"
                >
                  Add your first contact
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'skus' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">SKU Restrictions</h3>
            <p className="text-gray-500 mt-1">
              {community.restrict_skus
                ? `${community.approved_sku_ids?.length || 0} SKUs are approved for this community.`
                : 'All SKUs are currently allowed.'}
            </p>
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Manage SKU Restrictions
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditor && (
        <CommunityEditorModal
          community={community}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
