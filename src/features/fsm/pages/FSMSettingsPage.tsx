import { useState } from 'react';
import { MapPin, Users, User, Settings } from 'lucide-react';
import { TerritoriesList, CrewsList, SalesRepsList } from '../components';

type TabId = 'territories' | 'crews' | 'sales_reps';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'territories', label: 'Territories', icon: MapPin },
  { id: 'crews', label: 'Crews', icon: Users },
  { id: 'sales_reps', label: 'Sales Reps', icon: User },
];

export default function FSMSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('territories');

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">FSM Settings</h1>
            <p className="text-sm text-gray-500">
              Configure territories, crews, and sales representatives
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'territories' && <TerritoriesList />}
        {activeTab === 'crews' && <CrewsList />}
        {activeTab === 'sales_reps' && <SalesRepsList />}
      </div>
    </div>
  );
}
