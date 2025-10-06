import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle, Archive, DollarSign, Package, Wrench, Building2, AlertTriangle, ChevronRight, Filter } from 'lucide-react';
import type { Request, RequestStage, RequestType } from '../../lib/requests';
import { useMyRequests } from '../../hooks/useRequests';
import { useRequestAge } from '../../hooks/useRequests';

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
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<RequestType | 'all'>('all');
  const [filterStage, setFilterStage] = useState<RequestStage | 'all'>('all');

  const { requests, loading, error, refresh } = useMyRequests({
    stage: activeTab === 'active' ? undefined : activeTab === 'completed' ? 'completed' : 'archived'
  });

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

    return true;
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
            onClick={refresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Advanced Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
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

        <div className="grid grid-cols-2 gap-3">
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
        </div>
      </div>

      {/* Request List */}
      {filteredRequests.length === 0 ? (
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
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <button
              key={request.id}
              onClick={() => onRequestClick(request)}
              className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <RequestTypeIcon type={request.request_type} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {request.title}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>

                  {request.customer_name && (
                    <p className="text-sm text-gray-600 mb-2">
                      {request.customer_name}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <RequestStageBadge stage={request.stage} quoteStatus={request.quote_status} />
                    <RequestAgeIndicator request={request} />

                    {request.pricing_quote && (
                      <span className="text-xs text-gray-600">
                        ${request.pricing_quote.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {request.sla_status === 'breached' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      SLA breached
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
