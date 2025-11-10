import { Settings, Target, Calendar, AlertCircle } from 'lucide-react';
import { useFunctionsQuery } from '../hooks/useLeadershipQuery';
import { useAuth } from '../../../contexts/AuthContext';

interface DashboardProps {
  onViewFunction: (functionId: string) => void;
  onViewMyInitiatives: () => void;
  onViewHighPriority: () => void;
  onViewWeeklyCheckin: () => void;
  onViewSettings: () => void;
}

export default function Dashboard({
  onViewFunction,
  onViewMyInitiatives,
  onViewHighPriority,
  onViewWeeklyCheckin,
  onViewSettings,
}: DashboardProps) {
  const { profile } = useAuth();
  const { data: functions, isLoading } = useFunctionsQuery();

  const isAdmin = profile?.role === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leadership dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Leadership Dashboard</h1>
              <p className="text-gray-600 mt-1">Project management & strategic initiatives</p>
            </div>
            {isAdmin && (
              <button
                onClick={onViewSettings}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={onViewMyInitiatives}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">My Work</div>
                <div className="text-2xl font-bold text-gray-900">View All</div>
                <div className="text-sm text-gray-500 mt-2">Initiatives assigned to me</div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </button>

          <button
            onClick={onViewWeeklyCheckin}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-300 transition-all text-left"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Weekly Update</div>
                <div className="text-2xl font-bold text-gray-900">Check-in</div>
                <div className="text-sm text-gray-500 mt-2">Update progress on initiatives</div>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </button>

          {isAdmin && (
            <button
              onClick={onViewHighPriority}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-orange-300 transition-all text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-1">High Priority</div>
                  <div className="text-2xl font-bold text-gray-900">View All</div>
                  <div className="text-sm text-gray-500 mt-2">Critical initiatives across all functions</div>
                </div>
                <div className="bg-orange-100 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Functions Grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Functions</h2>

          {functions && functions.length > 0 ? (
            <div className="grid grid-cols-3 gap-6">
              {functions.map((func) => (
                <button
                  key={func.id}
                  onClick={() => onViewFunction(func.id)}
                  className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:shadow-lg hover:border-blue-400 transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {func.name}
                      </h3>
                      {func.description && (
                        <p className="text-sm text-gray-600 mt-1">{func.description}</p>
                      )}
                    </div>
                    {func.icon && (
                      <div className={`bg-${func.color || 'blue'}-100 p-3 rounded-lg`}>
                        <div className="w-6 h-6" /> {/* Icon placeholder */}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Areas:</span>{' '}
                      <span className="font-semibold text-gray-900">{func.area_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Initiatives:</span>{' '}
                      <span className="font-semibold text-gray-900">{func.initiative_count || 0}</span>
                    </div>
                  </div>

                  {(func.high_priority_count || 0) > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                      <AlertCircle className="w-3 h-3" />
                      {func.high_priority_count} High Priority
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-600 mb-4">No functions available yet.</p>
              {isAdmin && (
                <button
                  onClick={onViewSettings}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create your first function in Settings →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
