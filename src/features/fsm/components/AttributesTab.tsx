import { useState } from 'react';
import { MapPin, Wrench } from 'lucide-react';
import TerritoriesList from './TerritoriesList';
import ProjectTypesList from './ProjectTypesList';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';

type SubTab = 'territories' | 'project_types';

export default function AttributesTab() {
  const { data: businessUnits } = useBusinessUnits();
  const [subTab, setSubTab] = useState<SubTab>('territories');
  const [selectedBU, setSelectedBU] = useState<string>('');

  return (
    <div className="space-y-4">
      {/* BU Filter + Sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('territories')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === 'territories'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Territories
          </button>
          <button
            onClick={() => setSubTab('project_types')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === 'project_types'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Project Types
          </button>
        </div>

        {/* BU Filter */}
        {businessUnits && businessUnits.length > 1 && (
          <select
            value={selectedBU}
            onChange={(e) => setSelectedBU(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="">All Business Units</option>
            {businessUnits.map(bu => (
              <option key={bu.id} value={bu.id}>{bu.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {subTab === 'territories' && (
        <TerritoriesList />
      )}
      {subTab === 'project_types' && (
        <ProjectTypesList filterByBusinessUnit={selectedBU || undefined} />
      )}
    </div>
  );
}
