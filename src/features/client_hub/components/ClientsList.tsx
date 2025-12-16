import { useState } from 'react';
import {
  Plus,
  Search,
  Building2,
  MoreVertical,
  Edit2,
  Trash2,
  Home,
  Phone,
  Mail,
  Filter,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useClients, useDeleteClient } from '../hooks/useClients';
import {
  BUSINESS_UNIT_LABELS,
  CLIENT_TYPE_LABELS,
  CLIENT_STATUS_LABELS,
  type Client,
  type BusinessUnit,
  type ClientStatus,
} from '../types';
import ClientEditorModal from './ClientEditorModal';

interface ClientsListProps {
  /** Called when user clicks a client row - navigates to detail page */
  onSelectClient?: (clientId: string) => void;
}

export default function ClientsList({
  onSelectClient,
}: ClientsListProps) {
  const [search, setSearch] = useState('');
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: clients, isLoading } = useClients({
    search,
    business_unit: businessUnitFilter || undefined,
    client_type: clientTypeFilter || undefined,
    status: statusFilter || undefined,
  });

  const deleteMutation = useDeleteClient();

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = (client: Client) => {
    if (confirm(`Delete "${client.name}"? This will also delete all communities.`)) {
      deleteMutation.mutate(client.id);
    }
    setMenuOpen(null);
  };

  const getStatusBadge = (status: ClientStatus) => {
    const styles: Record<ClientStatus, string> = {
      prospect: 'bg-yellow-100 text-yellow-700',
      onboarding: 'bg-blue-100 text-blue-700',
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
    };
    return styles[status];
  };

  const getBusinessUnitBadge = (bu: BusinessUnit) => {
    const styles: Record<BusinessUnit, string> = {
      residential: 'bg-purple-100 text-purple-700',
      commercial: 'bg-orange-100 text-orange-700',
      builders: 'bg-blue-100 text-blue-700',
    };
    return styles[bu];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
              showFilters || businessUnitFilter || clientTypeFilter || statusFilter
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        <button
          onClick={() => {
            setEditingClient(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Client
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <select
            value={businessUnitFilter}
            onChange={(e) => setBusinessUnitFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Business Units</option>
            {Object.entries(BUSINESS_UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={clientTypeFilter}
            onChange={(e) => setClientTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Client Types</option>
            {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {(businessUnitFilter || clientTypeFilter || statusFilter) && (
            <button
              onClick={() => {
                setBusinessUnitFilter('');
                setClientTypeFilter('');
                setStatusFilter('');
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : clients?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No clients yet</h3>
          <p className="text-gray-500 mt-1">Create your first client to get started</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Communities</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients?.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    // Navigate to client detail page
                    if (onSelectClient) {
                      onSelectClient(client.id);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{client.name}</span>
                          {client.quickbooks_id ? (
                            <span title="Synced with QBO"><CheckCircle2 className="w-4 h-4 text-green-500" /></span>
                          ) : (
                            <span title="Not synced with QBO"><XCircle className="w-4 h-4 text-red-400" /></span>
                          )}
                        </div>
                        {client.code && (
                          <div className="text-sm text-gray-500">{client.code}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getBusinessUnitBadge(client.business_unit)}`}>
                        {BUSINESS_UNIT_LABELS[client.business_unit]}
                      </span>
                      <div className="text-sm text-gray-500">
                        {CLIENT_TYPE_LABELS[client.client_type]}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {client.primary_contact_name ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">
                          {client.primary_contact_name}
                        </div>
                        {client.primary_contact_email && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail className="w-3 h-3" />
                            {client.primary_contact_email}
                          </div>
                        )}
                        {client.primary_contact_phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" />
                            {client.primary_contact_phone}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No contact</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {client.communities_count || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(client.status)}`}>
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === client.id ? null : client.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === client.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                          <button
                            onClick={() => handleEdit(client)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDelete(client)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <ClientEditorModal
          client={editingClient}
          onClose={() => {
            setShowEditor(false);
            setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}
