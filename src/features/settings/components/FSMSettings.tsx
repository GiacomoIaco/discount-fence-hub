import { useState } from 'react';
import { Sliders, Users, Truck, ClipboardList, UserCheck } from 'lucide-react';
import {
  RequestsList,
  AttributesTab,
  FsmTeamList,
  CrewsList,
  SalesRepsList,
} from '../../fsm/components';

type TabId = 'requests' | 'attributes' | 'team' | 'crews' | 'sales_reps';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; description?: string }[] = [
  { id: 'requests', label: 'Service Requests', icon: ClipboardList },
  { id: 'attributes', label: 'Attributes', icon: Sliders, description: 'Territories & Project Types' },
  { id: 'team', label: 'Team', icon: UserCheck, description: 'FSM roles & skills' },
  { id: 'crews', label: 'Crews', icon: Truck },
  { id: 'sales_reps', label: 'Sales Reps', icon: Users, description: 'Legacy' },
];

export default function FSMSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('requests');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Field Service Management
        </h2>
        <p className="text-sm text-gray-500">
          Configure territories, teams, crews, and scheduling attributes
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-px overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              title={tab.description}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'requests' && <RequestsList />}
        {activeTab === 'attributes' && <AttributesTab />}
        {activeTab === 'team' && <FsmTeamList />}
        {activeTab === 'crews' && <CrewsList />}
        {activeTab === 'sales_reps' && <SalesRepsList />}
      </div>
    </div>
  );
}
