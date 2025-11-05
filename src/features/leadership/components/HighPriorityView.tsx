import { useState } from 'react';
import { ArrowLeft, AlertTriangle, FolderOpen } from 'lucide-react';
import { useHighPriorityInitiativesQuery } from '../hooks/useLeadershipQuery';
import { useAuth } from '../../../contexts/AuthContext';
import InitiativeCard from './InitiativeCard';
import InitiativeDetailModal from './InitiativeDetailModal';

interface HighPriorityViewProps {
  onBack: () => void;
}

export default function HighPriorityView({ onBack }: HighPriorityViewProps) {
  const { profile } = useAuth();
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string>('all');

  const { data: initiatives, isLoading } = useHighPriorityInitiativesQuery();

  // Check admin permission
  const isAdmin = profile?.role === 'admin';

  // Apply color status filter
  const filteredInitiatives = initiatives?.filter((initiative) => {
    return colorFilter === 'all' || initiative.color_status === colorFilter;
  });

  // Group by color status
  const redInitiatives = filteredInitiatives?.filter(i => i.color_status === 'red') || [];
  const yellowInitiatives = filteredInitiatives?.filter(i => i.color_status === 'yellow') || [];
  const greenInitiatives = filteredInitiatives?.filter(i => i.color_status === 'green') || [];

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600 mb-6">
            You need administrator privileges to view high priority initiatives across all functions.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading high priority initiatives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900">High Priority Initiatives</h1>
              </div>
              <p className="text-sm text-gray-700 mt-1">
                {filteredInitiatives?.length || 0} critical initiative{filteredInitiatives?.length !== 1 ? 's' : ''} requiring attention
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Color Filter */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setColorFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  colorFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({initiatives?.length || 0})
              </button>
              <button
                onClick={() => setColorFilter('red')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  colorFilter === 'red'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                🔴 Red ({redInitiatives.length})
              </button>
              <button
                onClick={() => setColorFilter('yellow')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  colorFilter === 'yellow'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                🟡 Yellow ({yellowInitiatives.length})
              </button>
              <button
                onClick={() => setColorFilter('green')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  colorFilter === 'green'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                🟢 Green ({greenInitiatives.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredInitiatives && filteredInitiatives.length > 0 ? (
          <div className="space-y-8">
            {/* Red Initiatives */}
            {(colorFilter === 'all' || colorFilter === 'red') && redInitiatives.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  Critical - Immediate Attention Required ({redInitiatives.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {redInitiatives.map((initiative) => (
                    <InitiativeCard
                      key={initiative.id}
                      initiative={initiative}
                      onClick={() => setSelectedInitiativeId(initiative.id)}
                      showBucket
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Yellow Initiatives */}
            {(colorFilter === 'all' || colorFilter === 'yellow') && yellowInitiatives.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-yellow-600 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  At Risk - Needs Monitoring ({yellowInitiatives.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yellowInitiatives.map((initiative) => (
                    <InitiativeCard
                      key={initiative.id}
                      initiative={initiative}
                      onClick={() => setSelectedInitiativeId(initiative.id)}
                      showBucket
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Green Initiatives */}
            {(colorFilter === 'all' || colorFilter === 'green') && greenInitiatives.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-green-600 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  On Track ({greenInitiatives.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {greenInitiatives.map((initiative) => (
                    <InitiativeCard
                      key={initiative.id}
                      initiative={initiative}
                      onClick={() => setSelectedInitiativeId(initiative.id)}
                      showBucket
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <FolderOpen className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {colorFilter !== 'all' ? 'No matching initiatives' : 'No high priority initiatives'}
            </h3>
            <p className="text-gray-600">
              {colorFilter !== 'all'
                ? 'Try selecting a different status filter.'
                : 'High priority initiatives will appear here when they are created.'}
            </p>
          </div>
        )}
      </div>

      {/* Initiative Detail Modal */}
      {selectedInitiativeId && (
        <InitiativeDetailModal
          initiativeId={selectedInitiativeId}
          onClose={() => setSelectedInitiativeId(null)}
        />
      )}
    </div>
  );
}
