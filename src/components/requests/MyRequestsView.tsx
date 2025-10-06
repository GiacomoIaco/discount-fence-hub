import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Request } from '../../lib/requests';
import RequestList from './RequestList';
import RequestDetail from './RequestDetail';
import RequestHub from './RequestHub';
import { useMyRequests } from '../../hooks/useRequests';

interface MyRequestsViewProps {
  onBack: () => void;
}

type View = 'list' | 'detail' | 'hub';

export default function MyRequestsView({ onBack: _onBack }: MyRequestsViewProps) {
  const [view, setView] = useState<View>('list');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Fetch all requests for statistics
  const { requests } = useMyRequests({});

  // Calculate statistics
  const stats = {
    total: requests.length,
    new: requests.filter(r => r.stage === 'new').length,
    pending: requests.filter(r => r.stage === 'pending').length,
    completed: requests.filter(r => r.stage === 'completed').length,
  };

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setView('detail');
  };

  const handleCloseDetail = () => {
    setSelectedRequest(null);
    setView('list');
  };

  const handleNewRequest = () => {
    setView('hub');
  };

  // Show RequestHub for creating new requests
  if (view === 'hub') {
    return <RequestHub onBack={() => setView('list')} />;
  }

  // Show detail view
  if (view === 'detail' && selectedRequest) {
    return <RequestDetail request={selectedRequest} onClose={handleCloseDetail} />;
  }

  // Show list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Requests</h1>
          <p className="text-gray-600 mt-1">Track and manage your requests</p>
        </div>
        <button
          onClick={handleNewRequest}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Request
        </button>
      </div>

      {/* Statistics Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
          <div className="text-sm text-blue-600 font-medium mt-1">Total</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-green-700">{stats.new}</div>
          <div className="text-sm text-green-600 font-medium mt-1">New</div>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600 font-medium mt-1">In Progress</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-purple-700">{stats.completed}</div>
          <div className="text-sm text-purple-600 font-medium mt-1">Completed</div>
        </div>
      </div>

      <RequestList
        onRequestClick={handleRequestClick}
        onNewRequest={handleNewRequest}
      />
    </div>
  );
}
