import { useState } from 'react';
import { ArrowLeft, FolderOpen, Filter, LayoutGrid, Table, Target, AlertCircle, CheckCircle, TrendingUp, FileDown } from 'lucide-react';
import { useMyInitiativesQuery } from '../hooks/useLeadershipQuery';
import { useAuth } from '../../../contexts/AuthContext';
import InitiativeCard from './InitiativeCard';
import InitiativeDetailModal from './InitiativeDetailModal';
import InitiativeTableView from './InitiativeTableView';
import { exportMyInitiativesPDF } from '../lib/pdfExport';

interface MyInitiativesViewProps {
  onBack: () => void;
}

type ViewMode = 'cards' | 'table';

export default function MyInitiativesView({ onBack }: MyInitiativesViewProps) {
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const { profile } = useAuth();
  const { data: initiatives, isLoading } = useMyInitiativesQuery();

  // Calculate summary statistics
  const totalInitiatives = initiatives?.length || 0;
  const activeInitiatives = initiatives?.filter(i => i.status === 'active').length || 0;
  const completedInitiatives = initiatives?.filter(i => i.status === 'completed').length || 0;
  const atRiskInitiatives = initiatives?.filter(i => i.color_status === 'red').length || 0;

  // Apply filters
  const filteredInitiatives = initiatives?.filter((initiative) => {
    const matchesStatus = statusFilter === 'all' || initiative.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || initiative.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  const handleExportPDF = () => {
    if (initiatives) {
      exportMyInitiativesPDF(initiatives, profile?.full_name || 'Unknown User');
    }
  };

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
          <div className="flex items-center justify-between">
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
                  Track and update initiatives assigned to you
                </p>
              </div>
            </div>
            {initiatives && initiatives.length > 0 && (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileDown className="w-5 h-5" />
                Export PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-blue-600 mb-1">Total Initiatives</div>
                  <div className="text-2xl font-bold text-blue-900">{totalInitiatives}</div>
                </div>
                <div className="bg-blue-100 p-2 rounded">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-green-600 mb-1">Active</div>
                  <div className="text-2xl font-bold text-green-900">{activeInitiatives}</div>
                </div>
                <div className="bg-green-100 p-2 rounded">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-emerald-600 mb-1">Completed</div>
                  <div className="text-2xl font-bold text-emerald-900">{completedInitiatives}</div>
                </div>
                <div className="bg-emerald-100 p-2 rounded">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-red-600 mb-1">At Risk</div>
                  <div className="text-2xl font-bold text-red-900">{atRiskInitiatives}</div>
                </div>
                <div className="bg-red-100 p-2 rounded">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Table className="w-4 h-4" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredInitiatives && filteredInitiatives.length > 0 ? (
          viewMode === 'table' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <InitiativeTableView
                initiatives={filteredInitiatives}
                onInitiativeClick={(id) => setSelectedInitiativeId(id)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInitiatives.map((initiative) => (
                <InitiativeCard
                  key={initiative.id}
                  initiative={initiative}
                  onClick={() => setSelectedInitiativeId(initiative.id)}
                />
              ))}
            </div>
          )
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
