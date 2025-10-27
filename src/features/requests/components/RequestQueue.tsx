import { useState } from 'react';
import { Clock, AlertCircle, Users, Filter, TrendingUp, ArrowLeft } from 'lucide-react';
import type { Request, RequestStage, RequestType, SLAStatus } from '../lib/requests';
import { useAllRequestsQuery, useAssignRequestMutation, useUpdateRequestStageMutation } from '../hooks/useRequestsQuery';
import { useRequestAge, useUsers } from '../hooks/useRequests';
import { useAuth } from '../../../contexts/AuthContext';
import { showError } from '../../../lib/toast';

interface RequestQueueProps {
  onBack: () => void;
  onRequestClick: (request: Request) => void;
}

export default function RequestQueue({ onBack, onRequestClick }: RequestQueueProps) {
  const { profile } = useAuth();
  const [filterStage, setFilterStage] = useState<RequestStage | 'all'>('all');
  const [filterType, setFilterType] = useState<RequestType | 'all'>('all');
  const [filterSLA, setFilterSLA] = useState<SLAStatus | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterSubmitter, setFilterSubmitter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { users } = useUsers();

  const { data: requests = [], isLoading: loading, error } = useAllRequestsQuery({
    stage: filterStage !== 'all' ? filterStage : undefined,
    request_type: filterType !== 'all' ? filterType : undefined,
    sla_status: filterSLA !== 'all' ? filterSLA : undefined,
    assigned_to: filterAssignee !== 'all' ? filterAssignee : undefined,
    submitter_id: filterSubmitter !== 'all' ? filterSubmitter : undefined,
    search: searchTerm || undefined
  });

  // Stats
  const stats = {
    total: requests.length,
    new: requests.filter(r => r.stage === 'new').length,
    pending: requests.filter(r => r.stage === 'pending').length,
    breached: requests.filter(r => r.sla_status === 'breached').length,
    atRisk: requests.filter(r => r.sla_status === 'at_risk').length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading request queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load requests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Request Queue</h1>
              <p className="text-xs text-gray-600">Manage all requests</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-blue-700">{stats.total}</div>
              <div className="text-xs text-blue-600">Total</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-green-700">{stats.new}</div>
              <div className="text-xs text-green-600">New</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-600">Pending</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-orange-700">{stats.atRisk}</div>
              <div className="text-xs text-orange-600">At Risk</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-red-700">{stats.breached}</div>
              <div className="text-xs text-red-600">Breached</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <Filter className="w-4 h-4" />
          Filters
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer, project, title..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Stage Filter */}
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value as RequestStage | 'all')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Stages</option>
          <option value="new">New</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as RequestType | 'all')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="pricing">Pricing</option>
          <option value="material">Material</option>
          <option value="warranty">Warranty</option>
          <option value="new_builder">New Builder</option>
          <option value="support">Support</option>
        </select>

        {/* SLA Filter */}
        <select
          value={filterSLA}
          onChange={(e) => setFilterSLA(e.target.value as SLAStatus | 'all')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All SLA Status</option>
          <option value="breached">Breached</option>
          <option value="at_risk">At Risk</option>
          <option value="on_track">On Track</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>

        {/* Submitter Filter */}
        <select
          value={filterSubmitter}
          onChange={(e) => setFilterSubmitter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Submitters</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>

      {/* Request List */}
      <div className="p-4 space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Users className="w-16 h-16 mx-auto" />
            </div>
            <p className="text-gray-600">No requests found</p>
          </div>
        ) : (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onClick={() => onRequestClick(request)}
              currentUserId={profile?.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Request Card Component
function RequestCard({
  request,
  onClick,
  currentUserId
}: {
  request: Request;
  onClick: () => void;
  currentUserId?: string;
}) {
  const age = useRequestAge(request);
  const { mutateAsync: assign, isPending: assigning } = useAssignRequestMutation();
  const { mutateAsync: updateStage, isPending: updating } = useUpdateRequestStageMutation();

  const handleAssignToMe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || assigning) return;

    try {
      await assign({ requestId: request.id, assigneeId: currentUserId });
    } catch (error) {
      console.error('Failed to assign request:', error);
      showError('Failed to assign request');
    }
  };

  const handleMarkPending = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (updating) return;

    try {
      await updateStage({ requestId: request.id, stage: 'pending' });
    } catch (error) {
      console.error('Failed to update stage:', error);
      showError('Failed to update stage');
    }
  };

  const handleMarkCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (updating) return;

    try {
      await updateStage({ requestId: request.id, stage: 'completed' });
    } catch (error) {
      console.error('Failed to update stage:', error);
      showError('Failed to update stage');
    }
  };

  const getSLAColor = () => {
    if (request.sla_status === 'breached') return 'border-l-red-500 bg-red-50';
    if (request.sla_status === 'at_risk') return 'border-l-yellow-500 bg-yellow-50';
    return 'border-l-green-500 bg-white';
  };

  const getTypeColor = () => {
    switch (request.request_type) {
      case 'pricing': return 'text-orange-600 bg-orange-100';
      case 'material': return 'text-yellow-600 bg-yellow-100';
      case 'warranty': return 'text-red-600 bg-red-100';
      case 'new_builder': return 'text-blue-600 bg-blue-100';
      case 'support': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`border-l-4 ${getSLAColor()} rounded-lg p-3 cursor-pointer hover:shadow-md transition-all`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{request.title}</h3>
          {request.customer_name && (
            <p className="text-sm text-gray-600">{request.customer_name}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getTypeColor()}`}>
            {request.request_type.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {age.days > 0 ? `${age.days}d ${age.hours % 24}h` : `${age.hours}h`}
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Priority: {request.priority_score || 0}
        </div>
        {request.expected_value && (
          <div className="text-green-700 font-medium">
            ${request.expected_value.toLocaleString()}
          </div>
        )}
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          request.stage === 'new' ? 'bg-blue-100 text-blue-700' :
          request.stage === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          request.stage === 'completed' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {request.stage}
        </span>

        {request.sla_status === 'breached' && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            SLA Breached
          </span>
        )}

        {request.sla_status === 'at_risk' && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            At Risk
          </span>
        )}

        {/* Quick Actions */}
        {request.stage === 'new' && !request.assigned_to && (
          <button
            onClick={handleAssignToMe}
            disabled={assigning}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 ml-auto"
          >
            {assigning ? 'Assigning...' : 'Assign to Me'}
          </button>
        )}

        {request.stage === 'new' && request.assigned_to && (
          <button
            onClick={handleMarkPending}
            disabled={updating}
            className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 ml-auto"
          >
            {updating ? 'Updating...' : 'Start Work'}
          </button>
        )}

        {request.stage === 'pending' && (
          <button
            onClick={handleMarkCompleted}
            disabled={updating}
            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 ml-auto"
          >
            {updating ? 'Updating...' : 'Mark Complete'}
          </button>
        )}
      </div>
    </div>
  );
}
