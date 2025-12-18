import { useState } from 'react';
import { Sliders, Truck, UserCheck } from 'lucide-react';
import {
  AttributesTab,
  FsmTeamList,
  CrewsList,
} from '../../fsm/components';

type TabId = 'attributes' | 'team' | 'crews';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; description?: string }[] = [
  { id: 'attributes', label: 'Attributes', icon: Sliders, description: 'Territories & Project Types' },
  { id: 'team', label: 'Team', icon: UserCheck, description: 'Reps, BU assignments & crew alignments' },
  { id: 'crews', label: 'Crews & Subs', icon: Truck, description: 'Internal crews & subcontractors' },
];

export default function FSMSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('attributes');

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
        {activeTab === 'attributes' && <AttributesTab />}
        {activeTab === 'team' && <FsmTeamList />}
        {activeTab === 'crews' && <CrewsList />}
      </div>
    </div>
  );
}
