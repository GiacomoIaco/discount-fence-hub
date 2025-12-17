/**
 * PropertyDetailPage - Full page view of a property/lot
 *
 * Shows all FSM activity for a specific address:
 * - Property info (address, lot, homeowner, gate code)
 * - Contacts for the property
 * - All Requests, Quotes, Jobs for this address
 *
 * Accessible via URL: /properties/:id
 */

import { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Home,
  User,
  Phone,
  Mail,
  Key,
  FileText,
  ClipboardList,
  Wrench,
  Edit2,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Navigation,
} from 'lucide-react';
import { useProperty, useDeletePropertyContact, useCreatePropertyContact } from '../hooks/useProperties';
import { useContactRoles } from '../hooks/useContacts';
import { usePropertyRequests, usePropertyQuotes, usePropertyJobs, usePropertySummary } from '../hooks/usePropertyFSM';
import { PROPERTY_STATUS_LABELS } from '../types';
import { hasValidCoordinates, formatCoordinates } from '../../shared/types/location';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
} from '../../fsm/types';
import PropertyEditorModal from '../components/PropertyEditorModal';
import type { EntityType } from '../../../lib/routes';

type Tab = 'overview' | 'requests' | 'quotes' | 'jobs';

interface PropertyDetailPageProps {
  propertyId: string;
  onBack: () => void;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
}

export default function PropertyDetailPage({
  propertyId,
  onBack,
  onNavigateToEntity,
}: PropertyDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showEditor, setShowEditor] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', role_id: '', email: '', phone: '' });

  const { data: property, isLoading } = useProperty(propertyId);
  const { data: contactRoles } = useContactRoles('property');
  const { data: summary } = usePropertySummary(propertyId);
  const { data: requests } = usePropertyRequests(propertyId);
  const { data: quotes } = usePropertyQuotes(propertyId);
  const { data: jobs } = usePropertyJobs(propertyId);

  const createContactMutation = useCreatePropertyContact();
  const deleteContactMutation = useDeletePropertyContact();

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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
      property_id: propertyId,
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
    { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'requests', label: 'Requests', icon: <ClipboardList className="w-4 h-4" />, count: summary?.requests },
    { id: 'quotes', label: 'Quotes', icon: <FileText className="w-4 h-4" />, count: summary?.quotes },
    { id: 'jobs', label: 'Jobs', icon: <Wrench className="w-4 h-4" />, count: summary?.jobs },
  ];

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    sold: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-gray-100 text-gray-700',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">Property not found</h2>
          <p className="text-gray-500 mt-1">The property you're looking for doesn't exist.</p>
          <button
            onClick={onBack}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <MapPin className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {property.address_line1}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[property.status]}`}>
                    {PROPERTY_STATUS_LABELS[property.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-gray-500">
                  {property.lot_number && (
                    <span>Lot {property.lot_number}</span>
                  )}
                  {property.block_number && (
                    <span>Block {property.block_number}</span>
                  )}
                  <span>
                    {property.city}, {property.state} {property.zip}
                  </span>
                </div>
                {/* Breadcrumb */}
                {property.community && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <Building2 className="w-4 h-4" />
                    <span>
                      {property.community.client?.name} → {property.community.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-gray-50 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary?.requests || 0}</div>
            <div className="text-sm text-gray-500">Requests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary?.quotes || 0}</div>
            <div className="text-sm text-gray-500">Quotes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary?.jobs || 0}</div>
            <div className="text-sm text-gray-500">Jobs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary?.totalValue)}</div>
            <div className="text-sm text-gray-500">Total Value</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 border-t bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Property Details */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Address</span>
                    <p className="font-medium">{property.address_line1}</p>
                    <p className="text-gray-600">
                      {property.city}, {property.state} {property.zip}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Lot / Block</span>
                    <p className="font-medium">
                      {property.lot_number ? `Lot ${property.lot_number}` : '-'}
                      {property.block_number ? `, Block ${property.block_number}` : ''}
                    </p>
                  </div>
                  {hasValidCoordinates(property.latitude, property.longitude) && (
                    <div className="col-span-2">
                      <span className="text-sm text-gray-500">GPS Coordinates</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Navigation className="w-4 h-4 text-green-600" />
                        <span className="font-mono text-sm">
                          {formatCoordinates(property.latitude!, property.longitude!, 6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Open in Maps
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Homeowner Info */}
              {(property.homeowner_name || property.homeowner_phone || property.homeowner_email) && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-400" />
                    Homeowner
                  </h3>
                  <div className="space-y-2">
                    {property.homeowner_name && (
                      <p className="font-medium">{property.homeowner_name}</p>
                    )}
                    {property.homeowner_phone && (
                      <p className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        {property.homeowner_phone}
                      </p>
                    )}
                    {property.homeowner_email && (
                      <p className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        {property.homeowner_email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Site Access */}
              {(property.gate_code || property.access_notes) && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-gray-400" />
                    Site Access
                  </h3>
                  {property.gate_code && (
                    <div className="mb-4">
                      <span className="text-sm text-gray-500">Gate Code</span>
                      <p className="font-mono text-lg font-bold text-blue-600">{property.gate_code}</p>
                    </div>
                  )}
                  {property.access_notes && (
                    <div>
                      <span className="text-sm text-gray-500">Access Notes</span>
                      <p className="whitespace-pre-wrap text-gray-700 bg-amber-50 p-3 rounded-lg mt-1">
                        {property.access_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {property.notes && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                  <p className="whitespace-pre-wrap text-gray-700">{property.notes}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contacts */}
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Site Contacts</h3>
                  <button
                    onClick={() => setShowAddContact(true)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {showAddContact && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                    <input
                      type="text"
                      placeholder="Name *"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <select
                      value={newContact.role_id}
                      onChange={(e) => setNewContact({ ...newContact, role_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Select role...</option>
                      {contactRoles?.map((role) => (
                        <option key={role.id} value={role.id}>{role.label}</option>
                      ))}
                    </select>
                    <input
                      type="email"
                      placeholder="Email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddContact}
                        disabled={createContactMutation.isPending}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddContact(false);
                          setNewContact({ name: '', role_id: '', email: '', phone: '' });
                        }}
                        className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {property.contacts && property.contacts.length > 0 ? (
                  <div className="space-y-3">
                    {property.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-start justify-between group">
                        <div>
                          <p className="font-medium text-gray-900">{contact.name}</p>
                          <p className="text-xs text-gray-500">
                            {contact.contact_role?.label || contact.role || 'Contact'}
                          </p>
                          {contact.phone && (
                            <p className="text-sm text-gray-600">{contact.phone}</p>
                          )}
                          {contact.email && (
                            <p className="text-sm text-gray-600">{contact.email}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteContactMutation.mutate({ id: contact.id, propertyId })}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No contacts added</p>
                )}
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span>{formatDate(property.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Updated</span>
                    <span>{formatDate(property.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {!requests?.length ? (
              <div className="bg-white rounded-lg border p-8 text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No requests for this property</p>
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => onNavigateToEntity?.('request', { id: request.id })}
                  className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{request.request_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[request.status]}`}>
                          {REQUEST_STATUS_LABELS[request.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {request.product_type || 'No product type'} • {request.source}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(request.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'quotes' && (
          <div className="space-y-3">
            {!quotes?.length ? (
              <div className="bg-white rounded-lg border p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No quotes for this property</p>
              </div>
            ) : (
              quotes.map((quote) => (
                <div
                  key={quote.id}
                  onClick={() => onNavigateToEntity?.('quote', { id: quote.id })}
                  className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{quote.quote_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QUOTE_STATUS_COLORS[quote.status]}`}>
                          {QUOTE_STATUS_LABELS[quote.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {quote.product_type || 'No product type'}
                        {quote.linear_feet && ` • ${quote.linear_feet} LF`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {formatDate(quote.created_at)}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(quote.total)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-3">
            {!jobs?.length ? (
              <div className="bg-white rounded-lg border p-8 text-center">
                <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No jobs for this property</p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => onNavigateToEntity?.('job', { id: job.id })}
                  className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{job.job_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                          {JOB_STATUS_LABELS[job.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {job.product_type || 'No product type'}
                        {job.linear_feet && ` • ${job.linear_feet} LF`}
                        {job.assigned_crew && ` • ${job.assigned_crew.name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {formatDate(job.scheduled_date || job.created_at)}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(job.quoted_total)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && property && (
        <PropertyEditorModal
          onClose={() => setShowEditor(false)}
          property={property}
          communityId={property.community_id}
        />
      )}
    </div>
  );
}
