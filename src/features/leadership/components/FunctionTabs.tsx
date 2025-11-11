import { ListTodo, Target } from 'lucide-react';

export type TabType = 'initiatives' | 'plans';

interface FunctionTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  functionName?: string;
}

export default function FunctionTabs({ activeTab, onTabChange, functionName }: FunctionTabsProps) {
  const tabs = [
    {
      id: 'initiatives' as TabType,
      label: 'Initiatives',
      icon: ListTodo,
      description: 'Track projects and tasks'
    },
    {
      id: 'plans' as TabType,
      label: 'Plans',
      icon: Target,
      description: 'Annual and quarterly goals'
    }
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Function Name / Breadcrumb */}
      {functionName && (
        <div className="px-6 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">{functionName}</h2>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
