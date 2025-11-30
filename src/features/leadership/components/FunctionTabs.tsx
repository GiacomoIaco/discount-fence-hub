import { ListTodo, Target, Lightbulb, Calendar, TrendingUp, Lock } from 'lucide-react';

export type TabType = 'strategy' | 'annual-plan' | 'quarterly-plan' | 'initiatives' | 'bonus-kpis';

interface FunctionTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  functionName?: string;
  selectedYear?: number;
  canEdit?: boolean;
  canSeeBonusKPIs?: boolean;
}

export default function FunctionTabs({
  activeTab,
  onTabChange,
  functionName,
  selectedYear,
  canEdit = true,
  canSeeBonusKPIs = true
}: FunctionTabsProps) {
  // Tabs that are year-specific
  const yearSpecificTabs = ['annual-plan', 'quarterly-plan', 'bonus-kpis'];

  const allTabs = [
    {
      id: 'strategy' as TabType,
      label: 'Strategy and Planning',
      icon: Lightbulb,
      description: 'Define function strategy and operating plan'
    },
    {
      id: 'annual-plan' as TabType,
      label: 'Annual Plan',
      icon: Target,
      description: 'Annual initiatives and targets'
    },
    {
      id: 'quarterly-plan' as TabType,
      label: 'Quarterly Plan',
      icon: Calendar,
      description: 'Quarterly objectives and execution'
    },
    {
      id: 'initiatives' as TabType,
      label: 'Initiatives',
      icon: ListTodo,
      description: 'Track projects and tasks'
    },
    {
      id: 'bonus-kpis' as TabType,
      label: 'Annual Bonus KPIs',
      icon: TrendingUp,
      description: 'Annual bonus key performance indicators',
      requiresBonusAccess: true
    }
  ];

  // Filter tabs based on permissions
  const tabs = allTabs.filter(tab => {
    if (tab.requiresBonusAccess && !canSeeBonusKPIs) {
      return false;
    }
    return true;
  });

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Function Name / Breadcrumb */}
      {functionName && (
        <div className="px-6 pt-4 pb-2 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{functionName}</h2>
          {!canEdit && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              <Lock className="w-3 h-3" />
              View Only
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            const showYearBadge = yearSpecificTabs.includes(tab.id) && selectedYear;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
                title={tab.description}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{tab.label}</span>
                {showYearBadge && (
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-semibold
                    ${isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}>
                    {selectedYear}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
