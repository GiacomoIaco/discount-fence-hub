import { useState } from 'react';
import { MapPin, Users, User } from 'lucide-react';
import { TerritoriesList, CrewsList, SalesRepsList } from '../../fsm/components';

type TabId = 'territories' | 'crews' | 'sales_reps';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'territories', label: 'Territories', icon: MapPin },
  { id: 'crews', label: 'Crews', icon: Users },
  { id: 'sales_reps', label: 'Sales Reps', icon: User },
];

export default function FSMSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('territories');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Field Service Management
        </h2>
        <p className="text-sm text-gray-500">
          Configure territories, crews, and sales representatives for job scheduling
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'territories' && <TerritoriesList />}
        {activeTab === 'crews' && <CrewsList />}
        {activeTab === 'sales_reps' && <SalesRepsList />}
      </div>
    </div>
  );
}
