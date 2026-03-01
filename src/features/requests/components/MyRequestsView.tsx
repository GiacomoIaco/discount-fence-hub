import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import type { Request } from '../lib/requests';
import RequestList from './RequestList';
import RequestDetail from './RequestDetail';
import RequestHub from '../RequestHub';
import { useMyRequestsQuery } from '../hooks/useRequestsQuery';
import { RequestListSkeleton } from '../../../components/skeletons';

interface MyRequestsViewProps {
  onBack: () => void;
  onMarkAsRead?: (requestId: string) => void;
  entityContext?: { type: string; id: string; params: Record<string, string> } | null;
  onClearEntity?: () => void;
}

type View = 'list' | 'detail' | 'hub';

export default function MyRequestsView({ onBack: _onBack, onMarkAsRead, entityContext, onClearEntity }: MyRequestsViewProps) {
  const [view, setView] = useState<View>(
    entityContext?.type === 'ticket' && entityContext.id ? 'detail' : 'list'
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    entityContext?.type === 'ticket' ? entityContext.id : null
  );

  // Handle deep-link from entity navigation (e.g., inbox "Go to Ticket")
  useEffect(() => {
    if (entityContext?.type === 'ticket' && entityContext.id) {
      setSelectedRequestId(entityContext.id);
      setView('detail');
    }
  }, [entityContext]);

  // Fetch all requests using React Query
  const { isLoading: loading, refetch: refresh } = useMyRequestsQuery({});

  const handleRequestClick = (request: Request) => {
    setSelectedRequestId(request.id);
    setView('detail');

    // Mark request as read when viewing
    if (onMarkAsRead) {
      onMarkAsRead(request.id);
    }
  };

  const handleCloseDetail = () => {
    setSelectedRequestId(null);
    setView('list');
    onClearEntity?.();
  };

  const handleNewRequest = () => {
    setView('hub');
  };

  // Show RequestHub for creating new requests
  if (view === 'hub') {
    return <RequestHub onBack={() => setView('list')} />;
  }

  // Show detail view
  if (view === 'detail' && selectedRequestId) {
    return (
      <RequestDetail
        requestId={selectedRequestId}
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
