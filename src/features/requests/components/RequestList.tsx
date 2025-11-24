import { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, Archive, DollarSign, Package, Wrench, Building2, AlertTriangle, ChevronRight, Filter, ChevronDown, ChevronUp, MessageCircle, User, X, Star } from 'lucide-react';
import type { Request, RequestStage, RequestType, SLAStatus } from '../lib/requests';
import { useMyRequestsQuery, useAllRequestsQuery } from '../hooks/useRequestsQuery';
import { useUsers, useRequestAge } from '../hooks/useRequests';
import { getUnreadCounts, getRequestViewStatus, getPinnedRequestIds, toggleRequestPin, getWatchedRequestIds } from '../lib/requests';
import { useAuth } from '../../../contexts/AuthContext';

interface RequestListProps {
  onRequestClick: (request: Request) => void;
  onNewRequest: () => void;
}

const RequestTypeIcon = ({ type }: { type: RequestType }) => {
  switch (type) {
    case 'pricing':
      return <DollarSign className="w-5 h-5 text-orange-600" />;
    case 'material':
      return <Package className="w-5 h-5 text-yellow-600" />;
    case 'support':
      return <AlertTriangle className="w-5 h-5 text-purple-600" />;
    case 'new_builder':
      return <Building2 className="w-5 h-5 text-blue-600" />;
    case 'warranty':
      return <Wrench className="w-5 h-5 text-red-600" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-600" />;
  }
};

const RequestStageBadge = ({ stage, quoteStatus }: { stage: RequestStage; quoteStatus?: 'won' | 'lost' | 'awaiting' | null }) => {
  if (stage === 'completed' && quoteStatus) {
    if (quoteStatus === 'won') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          <CheckCircle className="w-3 h-3" />
          Won
        </span>
      );
    }
    if (quoteStatus === 'lost') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
          <AlertCircle className="w-3 h-3" />
          Lost
        </span>
      );
    }
    if (quoteStatus === 'awaiting') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          <Clock className="w-3 h-3" />
          Awaiting
        </span>
      );
    }
  }

  switch (stage) {
    case 'new':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          <Clock className="w-3 h-3" />
          New
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
          <Clock className="w-3 h-3" />
          In Progress
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      );
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
          <Archive className="w-3 h-3" />
          Archived
        </span>
      );
  }
};

const RequestAgeIndicator = ({ request }: { request: Request }) => {
  const age = useRequestAge(request);

  const colorClasses = {
    green: 'bg-green-100 text-green-700 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    red: 'bg-red-100 text-red-700 border-red-200'
  };

  const ageText = age.days > 0
    ? `${age.days}d ${age.hours % 24}h`
    : `${age.hours}h`;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 border rounded-full text-xs font-medium ${colorClasses[age.color as keyof typeof colorClasses]}`}>
      <Clock className="w-3 h-3" />
      {ageText}
    </div>
  );
};

export default function RequestList({ onRequestClick, onNewRequest }: RequestListProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<RequestType | 'all'>('all');
  const [filterStage, setFilterStage] = useState<RequestStage | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterSubmitter, setFilterSubmitter] = useState<string>('all');
  const [filterSLA, setFilterSLA] = useState<SLAStatus | 'all'>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [viewedRequestIds, setViewedRequestIds] = useState<Set<string>>(new Set());
  const [pinnedRequestIds, setPinnedRequestIds] = useState<Set<string>>(new Set());
  const [watchedRequestIds, setWatchedRequestIds] = useState<Set<string>>(new Set());

  // Quick filter states
  const [quickFilters, setQuickFilters] = useState({
    older24h: false,
    older48h: false,
    mine: false,
    unassigned: false,
    hasUnread: false
  });

  // Sort state
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated'>('newest');

  // Sales role sees only their requests, everyone else sees all requests
  const isSalesOnly = profile?.role === 'sales';

  const myRequestsQuery = useMyRequestsQuery({
    stage: activeTab === 'active' ? undefined : activeTab === 'completed' ? 'completed' : 'archived'
  });

  const allRequestsQuery = useAllRequestsQuery({
    stage: activeTab === 'active' ? undefined : activeTab === 'completed' ? 'completed' : 'archived'
  });

  const query = isSalesOnly ? myRequestsQuery : allRequestsQuery;
  const requests = query.data || [];
  const loading = query.isLoading;
  const error = query.error;
  const refresh = query.refetch;

  const { users } = useUsers();

  // Handler for toggling pin status
  const handleTogglePin = async (e: React.MouseEvent | React.TouchEvent, requestId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent request card click

    try {
      const isPinned = await toggleRequestPin(requestId);

      // Update local state
      setPinnedRequestIds(prev => {
        const newSet = new Set(prev);
        if (isPinned) {
          newSet.add(requestId);
        } else {
          newSet.delete(requestId);
        }
        return newSet;
      });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Fetch unread counts, view status, pinned status, and watched requests when requests change
  useEffect(() => {
    const fetchRequestMetadata = async () => {
      if (!profile?.id || requests.length === 0) return;

      const requestIds = requests.map(r => r.id);
      const [counts, viewedIds, pinnedIds, watchedIds] = await Promise.all([
        getUnreadCounts(requestIds, profile.id),
        getRequestViewStatus(requestIds, profile.id),
        getPinnedRequestIds(profile.id),
        getWatchedRequestIds(profile.id)
      ]);
      setUnreadCounts(counts);
      setViewedRequestIds(viewedIds);
      setPinnedRequestIds(pinnedIds);
      setWatchedRequestIds(watchedIds);
    };

    fetchRequestMetadata();
  }, [requests, profile?.id]);

  // Filter requests by tab and advanced filters
  const filteredRequests = requests.filter(req => {
    // Tab filter
    if (activeTab === 'active' && !(req.stage === 'new' || req.stage === 'pending')) {
      return false;
    }
    if (activeTab === 'completed' && req.stage !== 'completed') {
      return false;
    }
    if (activeTab === 'archived' && req.stage !== 'archived') {
      return false;
    }

    // Quick filters
    if (quickFilters.older24h) {
      const submitted = new Date(req.submitted_at).getTime();
      const now = Date.now();
      const ageMs = now - submitted;
      const hours = Math.floor(ageMs / (1000 * 60 * 60));
      if (hours < 24) return false;
    }

    if (quickFilters.older48h) {
      const submitted = new Date(req.submitted_at).getTime();
      const now = Date.now();
      const ageMs = now - submitted;
      const hours = Math.floor(ageMs / (1000 * 60 * 60));
      if (hours < 48) return false;
    }

    if (quickFilters.mine && req.submitter_id !== profile?.id && req.assigned_to !== profile?.id && !watchedRequestIds.has(req.id)) {
      return false;
    }

    if (quickFilters.unassigned && req.assigned_to) {
      return false;
    }

    if (quickFilters.hasUnread) {
      const unreadCount = unreadCounts.get(req.id);
      if (!unreadCount || unreadCount === 0) return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        req.title?.toLowerCase().includes(search) ||
        req.customer_name?.toLowerCase().includes(search) ||
        req.project_number?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Type filter
    if (filterType !== 'all' && req.request_type !== filterType) {
      return false;
    }

    // Stage filter
    if (filterStage !== 'all' && req.stage !== filterStage) {
      return false;
    }

    // Assignee filter
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned' && req.assigned_to) {
        return false;
      }
      if (filterAssignee !== 'unassigned' && req.assigned_to !== filterAssignee) {
        return false;
      }
    }

    // Submitter filter
    if (filterSubmitter !== 'all' && req.submitter_id !== filterSubmitter) {
      return false;
    }

    // SLA filter
    if (filterSLA !== 'all' && req.sla_status !== filterSLA) {
      return false;
    }

    return true;
  });

  // Sort filtered requests (pinned requests always stay on top)
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aIsPinned = pinnedRequestIds.has(a.id);
    const bIsPinned = pinnedRequestIds.has(b.id);

    // Pinned requests always come first
    if (aIsPinned && !bIsPinned) return -1;
    if (!aIsPinned && bIsPinned) return 1;

    // If both pinned or both unpinned, sort by selected criteria
    switch (sortBy) {
      case 'newest':
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      case 'oldest':
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      case 'updated':
        const aTime = new Date(a.updated_at || a.submitted_at).getTime();
        const bTime = new Date(b.updated_at || b.submitted_at).getTime();
        return bTime - aTime;
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load requests</p>
          <button
            onClick={() => refresh()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'active'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Active
          {requests.filter(r => r.stage === 'new' || r.stage === 'pending').length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
              {requests.filter(r => r.stage === 'new' || r.stage === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'completed'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'archived'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Archived
        </button>
      </div>

      {/* Quick Filters Bar */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setQuickFilters(prev => ({ ...prev, older24h: !prev.older24h }))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quickFilters.older24h
              ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          &gt;24h
          {quickFilters.older24h && <X className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setQuickFilters(prev => ({ ...prev, older48h: !prev.older48h }))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quickFilters.older48h
              ? 'bg-red-100 text-red-700 border-2 border-red-400'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          &gt;48h
          {quickFilters.older48h && <X className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setQuickFilters(prev => ({ ...prev, mine: !prev.mine }))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quickFilters.mine
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Mine
          {quickFilters.mine && <X className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setQuickFilters(prev => ({ ...prev, unassigned: !prev.unassigned }))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quickFilters.unassigned
              ? 'bg-orange-100 text-orange-700 border-2 border-orange-400'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Unassigned
          {quickFilters.unassigned && <X className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => setQuickFilters(prev => ({ ...prev, hasUnread: !prev.hasUnread }))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            quickFilters.hasUnread
              ? 'bg-purple-100 text-purple-700 border-2 border-purple-400'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Has Unread
          {quickFilters.hasUnread && <X className="w-3.5 h-3.5" />}
        </button>

        {/* Clear all quick filters button */}
        {Object.values(quickFilters).some(v => v) && (
          <button
            onClick={() => setQuickFilters({
              older24h: false,
              older48h: false,
              mine: false,
              unassigned: false,
              hasUnread: false
            })}
            className="ml-2 text-xs text-gray-600 hover:text-gray-900 underline"
          >
            Clear all
          </button>
        )}
        </div>

        {/* Sort dropdown and Filters button */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'updated')}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="updated">Recently Updated</option>
          </select>

          {/* Filters button */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filtersExpanded
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(searchTerm || filterType !== 'all' || filterStage !== 'all' || filterAssignee !== 'all' || filterSubmitter !== 'all' || filterSLA !== 'all') && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">
                •
              </span>
            )}
            {filtersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {filtersExpanded && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 space-y-2">
            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer, project, title..."
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div className="grid grid-cols-2 gap-2">
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as RequestType | 'all')}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="pricing">Pricing</option>
            <option value="material">Material</option>
            <option value="warranty">Warranty</option>
            <option value="new_builder">New Builder</option>
            <option value="support">Support</option>
          </select>

          {/* Stage Filter */}
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value as RequestStage | 'all')}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Stages</option>
            <option value="new">New</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Submitters</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>

              {/* SLA Status Filter */}
              <select
                value={filterSLA}
                onChange={(e) => setFilterSLA(e.target.value as SLAStatus | 'all')}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent col-span-2"
              >
                <option value="all">All SLA Statuses</option>
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="breached">Breached</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Request List */}
      {sortedRequests.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Archive className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-gray-600 mb-4">No {activeTab} requests</p>
          {activeTab === 'active' && (
            <button
              onClick={onNewRequest}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Your First Request
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRequests.map((request) => {
            const submitter = users.find(u => u.id === request.submitter_id);
            const assignee = users.find(u => u.id === request.assigned_to);
            const isUnviewed = !viewedRequestIds.has(request.id);
            const isPinned = pinnedRequestIds.has(request.id);

            return (
              <button
                key={request.id}
                onClick={() => onRequestClick(request)}
                className={`w-full border rounded-xl p-3 hover:shadow-md transition-all text-left ${
                  isPinned
                    ? 'bg-gray-50 border-gray-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`relative p-1.5 rounded-lg ${isPinned ? 'bg-white' : 'bg-gray-50'}`}>
                    <RequestTypeIcon type={request.request_type} />
                    {isUnviewed && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {request.title}
                        </h3>
                        <button
                          onClick={(e) => handleTogglePin(e, request.id)}
                          onTouchStart={(e) => e.stopPropagation()}
                          className={`flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors ${
                            isPinned ? 'text-yellow-500' : 'text-gray-400'
                          }`}
                          title={isPinned ? 'Unpin request' : 'Pin request'}
                          aria-label={isPinned ? 'Unpin request' : 'Pin request'}
                        >
                          <Star className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 lg:hidden" />
                    </div>

                    {request.customer_name && (
                      <p className="text-sm text-gray-600 mb-1.5">
                        {request.customer_name}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <RequestStageBadge stage={request.stage} quoteStatus={request.quote_status} />
                      <RequestAgeIndicator request={request} />

                      {unreadCounts.get(request.id) && unreadCounts.get(request.id)! > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          <MessageCircle className="w-3 h-3" />
                          {unreadCounts.get(request.id)} new
                        </span>
                      )}

                      {request.pricing_quote && (
                        <span className="text-xs text-gray-600">
                          ${request.pricing_quote.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Last Activity */}
                    <div className="mt-1 text-xs text-gray-500">
                      Last activity: {(() => {
                        // Use updated_at if available, fallback to submitted_at
                        const timestamp = request.updated_at || request.submitted_at;
                        if (!timestamp) return 'unknown';

                        const updated = new Date(timestamp);
                        const now = new Date();
                        const diffMs = now.getTime() - updated.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);

                        if (diffMins < 1) return 'just now';
                        if (diffMins < 60) return `${diffMins}m ago`;
                        if (diffHours < 24) return `${diffHours}h ago`;
                        if (diffDays < 7) return `${diffDays}d ago`;
                        return updated.toLocaleDateString();
                      })()}
                    </div>

                    {request.sla_status === 'breached' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3" />
                        SLA breached
                      </div>
                    )}
                  </div>

                  {/* Desktop: Additional info on the right */}
                  <div className="hidden lg:flex lg:items-center lg:gap-6 lg:ml-4">
                    <div className="text-sm text-right w-[120px]">
                      <div className="text-gray-500 text-xs">Submitted by</div>
                      <div className="font-medium text-gray-900">{submitter?.name || 'Unknown'}</div>
                    </div>
                    <div className="text-sm text-right w-[120px]">
                      <div className="text-gray-500 text-xs">Assigned to</div>
                      <div className="font-medium text-gray-900">{assignee?.name || 'Unassigned'}</div>
                    </div>
                    <div className="text-sm text-right w-[100px]">
                      <div className="text-gray-500 text-xs">Value</div>
                      <div className={`font-semibold ${
                        request.quote_status === 'won' ? 'text-green-600' :
                        request.quote_status === 'lost' ? 'text-red-600' :
                        'text-gray-500'
                      }`}>
                        {(request.pricing_quote || request.expected_value)
                          ? `$${(request.pricing_quote || request.expected_value || 0).toLocaleString()}`
                          : '—'}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
