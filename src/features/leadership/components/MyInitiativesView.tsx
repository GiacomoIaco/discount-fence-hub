import { useState } from 'react';
import { ArrowLeft, FolderOpen, Filter } from 'lucide-react';
import { useMyInitiativesQuery } from '../hooks/useLeadershipQuery';
import InitiativeCard from './InitiativeCard';
import InitiativeDetailModal from './InitiativeDetailModal';

interface MyInitiativesViewProps {
  onBack: () => void;
}

export default function MyInitiativesView({ onBack }: MyInitiativesViewProps) {
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data: initiatives, isLoading } = useMyInitiativesQuery();

  // Apply filters
  const filteredInitiatives = initiatives?.filter((initiative) => {
    const matchesStatus = statusFilter === 'all' || initiative.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || initiative.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your initiatives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">My Initiatives</h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredInitiatives?.length || 0} initiative{filteredInitiatives?.length !== 1 ? 's' : ''} assigned to you
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="not_started">Not Started</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="at_risk">At Risk</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredInitiatives && filteredInitiatives.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInitiatives.map((initiative) => (
              <InitiativeCard
                key={initiative.id}
                initiative={initiative}
                onClick={() => setSelectedInitiativeId(initiative.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <FolderOpen className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No matching initiatives'
                : 'No initiatives assigned to you'}
            </h3>
            <p className="text-gray-600">
              {statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters to see more initiatives.'
                : 'Initiatives assigned to you will appear here.'}
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
