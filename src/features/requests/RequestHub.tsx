import { useState } from 'react';
import { ArrowLeft, DollarSign, Package, Wrench, Building2, AlertTriangle, Plus, Ticket } from 'lucide-react';
import type { RequestType, Request } from './lib/requests';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';

interface RequestHubProps {
  onBack: () => void;
}

type View = 'menu' | 'list' | 'form' | 'detail';

export default function RequestHub({ onBack }: RequestHubProps) {
  const [view, setView] = useState<View>('menu');
  const [selectedRequestType, setSelectedRequestType] = useState<RequestType | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const handleNewRequest = (type: RequestType) => {
    setSelectedRequestType(type);
    setView('form');
  };

  const handleCloseForm = () => {
    setSelectedRequestType(null);
    setView('menu');
  };

  const handleFormSuccess = () => {
    setSelectedRequestType(null);
    setView('list');
  };

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setView('detail');
  };

  const handleCloseDetail = () => {
    setSelectedRequest(null);
    setView('list');
  };

  // Menu View - Request Type Selection
  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Requests</h1>
              <p className="text-xs text-gray-600">Submit & track your requests</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Track Requests Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              My Requests
            </h2>
            <button
              onClick={() => setView('list')}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-5 rounded-xl shadow-md active:scale-98 transition-transform"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <Ticket className="w-7 h-7" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-lg">View All Requests</div>
                  <div className="text-sm text-green-100">Track status & responses</div>
                </div>
              </div>
            </button>
          </div>

          {/* Create New Request Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Request
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {/* Pricing Request */}
              <button
                onClick={() => handleNewRequest('pricing')}
                className="w-full bg-white border-2 border-orange-200 p-4 rounded-xl shadow-sm active:bg-orange-50 hover:border-orange-300 transition-all"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <DollarSign className="w-7 h-7 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Pricing</div>
                    <div className="text-xs text-gray-600 mt-0.5">Custom quotes</div>
                  </div>
                  <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    🎤 Voice
                  </div>
                </div>
              </button>

              {/* Material Request */}
              <button
                onClick={() => handleNewRequest('material')}
                className="w-full bg-white border-2 border-yellow-200 p-4 rounded-xl shadow-sm active:bg-yellow-50 hover:border-yellow-300 transition-all"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="bg-yellow-100 p-3 rounded-lg">
                    <Package className="w-7 h-7 text-yellow-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Material</div>
                    <div className="text-xs text-gray-600 mt-0.5">Request supplies</div>
                  </div>
                  <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    🎤 Voice
                  </div>
                </div>
              </button>

              {/* Warranty Request */}
              <button
                onClick={() => handleNewRequest('warranty')}
                className="w-full bg-white border-2 border-red-200 p-4 rounded-xl shadow-sm active:bg-red-50 hover:border-red-300 transition-all"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <Wrench className="w-7 h-7 text-red-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Warranty</div>
                    <div className="text-xs text-gray-600 mt-0.5">Installation issues</div>
                  </div>
                  <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    🎤 Voice
                  </div>
                </div>
              </button>

              {/* New Builder Request */}
              <button
                onClick={() => handleNewRequest('new_builder')}
                className="w-full bg-white border-2 border-blue-200 p-4 rounded-xl shadow-sm active:bg-blue-50 hover:border-blue-300 transition-all"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Building2 className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">New Builder</div>
                    <div className="text-xs text-gray-600 mt-0.5">Submit client</div>
                  </div>
                  <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    🎤 Voice
                  </div>
                </div>
              </button>

              {/* Support/Escalation Request */}
              <button
                onClick={() => handleNewRequest('support')}
                className="w-full bg-white border-2 border-purple-200 p-4 rounded-xl shadow-sm active:bg-purple-50 hover:border-purple-300 transition-all col-span-2"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <AlertTriangle className="w-7 h-7 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900">Support / Escalation</div>
                    <div className="text-xs text-gray-600 mt-0.5">Customer issues or help needed</div>
                  </div>
                  <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    🎤 Voice
                  </div>
                </div>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800">
                💡 <strong>Tip:</strong> Use voice recording for faster submission! Just describe the request and AI will extract the details.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setView('menu')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">My Requests</h1>
              <p className="text-xs text-gray-600">View status & responses</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <RequestList
            onRequestClick={handleRequestClick}
            onNewRequest={() => setView('menu')}
          />
        </div>

        {/* FAB - New Request */}
        <button
          onClick={() => setView('menu')}
          className="fixed right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-20"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    );
  }

  // Form View
  if (view === 'form' && selectedRequestType) {
    return (
      <RequestForm
        requestType={selectedRequestType}
        onClose={handleCloseForm}
        onSuccess={handleFormSuccess}
      />
    );
  }

  // Detail View
  if (view === 'detail' && selectedRequest) {
    return (
      <RequestDetail
        requestId={selectedRequest.id}
        onClose={handleCloseDetail}
      />
    );
  }

  return null;
}
