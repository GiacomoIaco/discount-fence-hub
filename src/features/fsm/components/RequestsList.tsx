import { useState } from 'react';
import { Plus, Phone, Globe, Users, Building, Calendar, MapPin, User, Search } from 'lucide-react';
import { useRequests, useDeleteRequest } from '../hooks';
import type { ServiceRequest, RequestStatus, RequestSource } from '../types';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../types';
import RequestEditorModal from './RequestEditorModal';

const SOURCE_ICONS: Record<RequestSource, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  web: Globe,
  referral: Users,
  walk_in: Building,
  builder_portal: Building,
};

interface RequestsListProps {
  onSelectRequest?: (request: ServiceRequest) => void;
}

export default function RequestsList({ onSelectRequest }: RequestsListProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ServiceRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filters = statusFilter === 'all' ? undefined : { status: statusFilter };
  const { data: requests, isLoading, error } = useRequests(filters);
  const deleteMutation = useDeleteRequest();

  const handleEdit = (request: ServiceRequest) => {
    setEditingRequest(request);
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingRequest(null);
    setShowEditor(true);
  };

  const handleDelete = async (request: ServiceRequest) => {
    if (confirm(`Delete request ${request.request_number}?`)) {
      await deleteMutation.mutateAsync(request.id);
    }
  };

  // Filter requests by search query
  const filteredRequests = requests?.filter(req => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.request_number?.toLowerCase().includes(query) ||
      req.contact_name?.toLowerCase().includes(query) ||
      req.address_line1?.toLowerCase().includes(query) ||
      req.city?.toLowerCase().includes(query) ||
      req.client?.name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Error loading requests: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Service Requests</h3>
          <p className="text-sm text-gray-500">
            Incoming work requests and assessments
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requests..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading requests...</div>
      ) : !filteredRequests?.length ? (
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
          <p className="text-gray-500 mb-4">No requests found</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create First Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const SourceIcon = SOURCE_ICONS[request.source];
            return (
              <div
                key={request.id}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      {/* Source Icon */}
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <SourceIcon className="w-5 h-5 text-gray-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header Row */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {request.request_number}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${REQUEST_STATUS_COLORS[request.status]}`}>
                            {REQUEST_STATUS_LABELS[request.status]}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[request.priority]}`}>
                            {PRIORITY_LABELS[request.priority]}
                          </span>
                        </div>

                        {/* Customer / Contact */}
                        <p className="text-sm font-medium text-gray-800">
                          {request.client?.name || request.contact_name || 'Unknown Customer'}
                        </p>

                        {/* Address */}
                        {request.address_line1 && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {request.address_line1}, {request.city} {request.zip}
                          </p>
                        )}

                        {/* Product Type & LF */}
                        {request.product_type && (
                          <p className="text-sm text-gray-600 mt-1">
                            {request.product_type}
                            {request.linear_feet_estimate && ` - ${request.linear_feet_estimate} LF`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side Info */}
                  <div className="flex flex-col items-end gap-2 text-sm">
                    {/* Created Date */}
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(request.created_at)}
                    </div>

                    {/* Assessment Date */}
                    {request.assessment_scheduled_at && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Calendar className="w-3 h-3" />
                        Assessment: {formatDate(request.assessment_scheduled_at)}
                      </div>
                    )}

                    {/* Assigned Rep */}
                    {request.assigned_rep && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        {request.assigned_rep.name}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(request)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(request)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                      {onSelectRequest && (
                        <button
                          onClick={() => onSelectRequest(request)}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description Preview */}
                {request.description && (
                  <p className="mt-3 pt-3 border-t text-sm text-gray-600 line-clamp-2">
                    {request.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <RequestEditorModal
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingRequest(null);
        }}
        request={editingRequest}
      />
    </div>
  );
}
