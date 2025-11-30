import { useState } from 'react';
import {
  Plus,
  Search,
  ChevronRight,
  Target,
  BarChart3,
  Settings,
  Briefcase,
  TrendingUp,
  Users,
  DollarSign,
  BarChart,
  Wrench,
  Truck,
  Building,
  ShoppingCart,
  Megaphone,
  Award,
  Zap
} from 'lucide-react';
import { useFunctionsQuery, useUserFunctionAccess } from '../hooks/useLeadershipQuery';
import { useInitiativesQuery } from '../hooks/useLeadershipQuery';

// Icon mapping for function icons
const ICON_MAP: Record<string, any> = {
  Briefcase,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  BarChart,
  Wrench,
  Truck,
  Building,
  ShoppingCart,
  Megaphone,
  Award,
  Zap
};

interface FunctionSidebarProps {
  selectedFunctionId?: string | null;
  onSelectFunction?: (functionId: string) => void;
  onReportsClick?: () => void;
  onSettingsClick?: () => void;
  onNewFunctionClick?: () => void;
  showingReports?: boolean;
  showingSettings?: boolean;
}

export default function FunctionSidebar({
  selectedFunctionId,
  onSelectFunction,
  onReportsClick,
  onSettingsClick,
  onNewFunctionClick,
  showingReports = false,
  showingSettings = false
}: FunctionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: functions, isLoading } = useFunctionsQuery();
  const { data: allInitiatives } = useInitiativesQuery();
  const { data: access } = useUserFunctionAccess();

  // Check if user can edit a specific function
  const canEditFunction = (functionId: string) => {
    if (access?.isSuperAdmin) return true;
    return access?.ownedFunctions.some(f => f.id === functionId) || false;
  };

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
              const IconComponent = func.icon ? ICON_MAP[func.icon] : null;
              const canEdit = canEditFunction(func.id);

              return (
                <button
                  key={func.id}
                  onClick={() => onSelectFunction?.(func.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  } ${!canEdit ? 'opacity-75' : ''}`}
                >
                  {/* Function Icon/Color with edit indicator ring */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2 ring-offset-2 ${
                      canEdit ? 'ring-green-500' : 'ring-transparent'
                    }`}
                    style={{ backgroundColor: func.color || '#6B7280' }}
                    title={canEdit ? 'You can edit this function' : 'View only'}
                  >
                    {IconComponent ? (
                      <IconComponent className="w-5 h-5" />
                    ) : (
                      func.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Function Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-medium truncate ${
                        isSelected ? 'text-blue-900' : canEdit ? 'text-gray-900' : 'text-gray-600'
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
                      {!canEdit && (
                        <>
                          <span className="text-xs text-gray-300">•</span>
                          <span className="text-xs text-gray-400 italic">view only</span>
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

      {/* Reports & Settings Buttons */}
      <div className="px-4 pb-2 border-t border-gray-200 pt-4 space-y-2">
        <button
          onClick={onReportsClick}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
            showingReports
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-gray-50 border border-transparent'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-medium ${
                showingReports ? 'text-blue-900' : 'text-gray-900'
              }`}>
                Reports
              </span>
              {showingReports && (
                <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Analytics & insights
            </div>
          </div>
        </button>

        <button
          onClick={onSettingsClick}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
            showingSettings
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-gray-50 border border-transparent'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-medium ${
                showingSettings ? 'text-blue-900' : 'text-gray-900'
              }`}>
                Settings
              </span>
              {showingSettings && (
                <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Functions & areas
            </div>
          </div>
        </button>
      </div>

      {/* Add Function Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
          onClick={onNewFunctionClick}
        >
          <Plus className="w-4 h-4" />
          New Function
        </button>
      </div>
    </div>
  );
}
