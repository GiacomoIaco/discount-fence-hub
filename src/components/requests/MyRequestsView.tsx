import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Request } from '../../lib/requests';
import RequestList from './RequestList';
import RequestDetail from './RequestDetail';
import RequestHub from './RequestHub';
import { useMyRequests } from '../../hooks/useRequests';
import { RequestListSkeleton } from '../skeletons';

interface MyRequestsViewProps {
  onBack: () => void;
  onMarkAsRead?: (requestId: string) => void;
}

type View = 'list' | 'detail' | 'hub';

export default function MyRequestsView({ onBack: _onBack, onMarkAsRead }: MyRequestsViewProps) {
  const [view, setView] = useState<View>('list');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Fetch all requests
  const { loading, refresh } = useMyRequests({});

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setView('detail');

    // Mark request as read when viewing
    if (onMarkAsRead) {
      onMarkAsRead(request.id);
    }
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
    return (
      <RequestDetail
        request={selectedRequest}
        onClose={handleCloseDetail}
        onUpdate={refresh}
      />
    );
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

      {loading ? (
        <RequestListSkeleton count={5} />
      ) : (
        <RequestList
          onRequestClick={handleRequestClick}
          onNewRequest={handleNewRequest}
        />
      )}
    </div>
  );
}
