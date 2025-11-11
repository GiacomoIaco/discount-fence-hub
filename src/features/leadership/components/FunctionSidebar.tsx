import { useState } from 'react';
import { Plus, Search, ChevronRight, Target } from 'lucide-react';
import { useFunctionsQuery } from '../hooks/useLeadershipQuery';
import { useInitiativesQuery } from '../hooks/useLeadershipQuery';

interface FunctionSidebarProps {
  selectedFunctionId?: string | null;
  onSelectFunction?: (functionId: string) => void;
}

export default function FunctionSidebar({
  selectedFunctionId,
  onSelectFunction
}: FunctionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: functions, isLoading } = useFunctionsQuery();
  const { data: allInitiatives } = useInitiativesQuery();

  // Filter functions by search
  const filteredFunctions = functions?.filter(func =>
    func.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Calculate initiative counts per function
  const getInitiativeCount = (functionId: string) => {
    if (!allInitiatives) return 0;
    return allInitiatives.filter(init => init.area?.function_id === functionId).length;
  };

  // Calculate % on track per function
  const getOnTrackPercent = (functionId: string) => {
    if (!allInitiatives) return 0;
    const functionInitiatives = allInitiatives.filter(
      init => init.area?.function_id === functionId
    );
    if (functionInitiatives.length === 0) return 0;
    const onTrack = functionInitiatives.filter(
      init => init.status === 'not_started' || init.status === 'on_hold'
    ).length;
    // Return inverse - initiatives NOT at risk
    return Math.round(((functionInitiatives.length - onTrack) / functionInitiatives.length) * 100);
  };

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return 'bg-green-500';
    if (percent >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Functions</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Function List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading functions...
          </div>
        ) : filteredFunctions.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {searchQuery ? 'No functions found' : 'No functions yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFunctions.map((func) => {
              const count = getInitiativeCount(func.id);
              const onTrackPercent = getOnTrackPercent(func.id);
              const isSelected = selectedFunctionId === func.id;

              return (
                <button
                  key={func.id}
                  onClick={() => onSelectFunction?.(func.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* Function Icon/Color */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{ backgroundColor: func.color || '#6B7280' }}
                  >
                    {func.icon || func.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Function Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-medium truncate ${
                        isSelected ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {func.name}
                      </span>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {count} initiative{count !== 1 ? 's' : ''}
                      </span>
                      {count > 0 && (
                        <>
                          <span className="text-xs text-gray-300">•</span>
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-2 h-2 rounded-full ${getStatusColor(onTrackPercent)}`}
                            />
                            <span className="text-xs text-gray-500">
                              {onTrackPercent}%
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Function Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
          onClick={() => {
            // TODO: Open create function modal
            alert('Create function modal - TODO');
          }}
        >
          <Plus className="w-4 h-4" />
          New Function
        </button>
      </div>
    </div>
  );
}
