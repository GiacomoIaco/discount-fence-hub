import { useState } from 'react';
import {
  Plus,
  Search,
  Home,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Building2,
  MapPin,
  Filter,
  Lock,
} from 'lucide-react';
import { useCommunities, useDeleteCommunity } from '../hooks/useCommunities';
import { useClients, useGeographies } from '../hooks/useClients';
import { COMMUNITY_STATUS_LABELS, type Community, type CommunityStatus } from '../types';
import CommunityEditorModal from './CommunityEditorModal';
import CommunityDetailModal from './CommunityDetailModal';

export default function CommunitiesList() {
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [geographyFilter, setGeographyFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [viewingCommunity, setViewingCommunity] = useState<Community | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: communities, isLoading } = useCommunities({
    search,
    client_id: clientFilter || undefined,
    geography_id: geographyFilter || undefined,
    status: statusFilter || undefined,
  });

  const { data: clients } = useClients({});
  const { data: geographies } = useGeographies();

  const deleteMutation = useDeleteCommunity();

  const handleEdit = (community: Community) => {
    setEditingCommunity(community);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = (community: Community) => {
    if (confirm(`Delete "${community.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(community.id);
    }
    setMenuOpen(null);
  };

  const getStatusBadge = (status: CommunityStatus) => {
    const styles: Record<CommunityStatus, string> = {
      onboarding: 'bg-blue-100 text-blue-700',
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      completed: 'bg-purple-100 text-purple-700',
    };
    return styles[status];
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
              placeholder="Search communities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
              showFilters || clientFilter || geographyFilter || statusFilter
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
            setEditingCommunity(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Community
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Clients</option>
            {clients?.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <select
            value={geographyFilter}
            onChange={(e) => setGeographyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Geographies</option>
            {geographies?.map((geo) => (
              <option key={geo.id} value={geo.id}>{geo.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(COMMUNITY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {(clientFilter || geographyFilter || statusFilter) && (
            <button
              onClick={() => {
                setClientFilter('');
                setGeographyFilter('');
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
      ) : communities?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No communities yet</h3>
          <p className="text-gray-500 mt-1">Create your first community to get started</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Community
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Community</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Geography</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU Restrictions</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {communities?.map((community) => (
                <tr
                  key={community.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setViewingCommunity(community)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <Home className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{community.name}</div>
                        {community.code && (
                          <div className="text-sm text-gray-500">{community.code}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {(community as any).client?.name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(community as any).geography ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {(community as any).geography.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {community.restrict_skus ? (
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-orange-600 font-medium">
                          {community.approved_sku_ids?.length || 0} SKUs only
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">All SKUs allowed</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(community.status)}`}>
                      {COMMUNITY_STATUS_LABELS[community.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === community.id ? null : community.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === community.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                          <button
                            onClick={() => {
                              setViewingCommunity(community);
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            onClick={() => handleEdit(community)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDelete(community)}
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
        <CommunityEditorModal
          community={editingCommunity}
          onClose={() => {
            setShowEditor(false);
            setEditingCommunity(null);
          }}
        />
      )}

      {/* Detail Modal */}
      {viewingCommunity && (
        <CommunityDetailModal
          communityId={viewingCommunity.id}
          onClose={() => setViewingCommunity(null)}
          onEdit={() => {
            setEditingCommunity(viewingCommunity);
            setViewingCommunity(null);
            setShowEditor(true);
          }}
        />
      )}
    </div>
  );
}
