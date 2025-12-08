import { Map, CheckSquare, Square } from 'lucide-react';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';

interface RoadmapStats {
  total: number;
  ideas: number;
  inProgress: number;
  done: number;
  approved: number;
  researched: number;
  parked: number;
}

interface HubCounts {
  ideasAndResearched: number;
  approved: number;
}

interface RoadmapSidebarProps {
  selectedHubs: Set<HubKey>;
  onToggleHub: (hub: HubKey) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  stats: RoadmapStats;
  hubCounts: Record<HubKey, HubCounts>;
}

export default function RoadmapSidebar({
  selectedHubs,
  onToggleHub,
  onSelectAll,
  onClearAll,
  stats,
  hubCounts
}: RoadmapSidebarProps) {
  const allSelected = selectedHubs.size === Object.keys(HUB_CONFIG).length;
  const noneSelected = selectedHubs.size === 0;

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Map className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Roadmap</h2>
        </div>

        {/* Select All / Clear All */}
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            disabled={allSelected}
            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
              allSelected
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            Select All
          </button>
          <button
            onClick={onClearAll}
            disabled={noneSelected}
            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
              noneSelected
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Hub List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {(Object.keys(HUB_CONFIG) as HubKey[]).map((hubKey) => {
            const config = HUB_CONFIG[hubKey];
            const isSelected = selectedHubs.has(hubKey);
            const counts = hubCounts[hubKey] || { ideasAndResearched: 0, approved: 0 };

            return (
              <button
                key={hubKey}
                onClick={() => onToggleHub(hubKey)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? `${config.bgLight} ${config.border} border`
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                {/* Checkbox indicator */}
                <div className={`flex-shrink-0 ${isSelected ? config.textColor : 'text-gray-400'}`}>
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </div>

                {/* Hub color dot */}
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${config.color}`}
                />

                {/* Hub info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${
                      isSelected ? config.textColor : 'text-gray-700'
                    }`}>
                      {config.label}
                    </span>
                  </div>
                  {/* Hub counts */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {counts.ideasAndResearched > 0 && (
                      <span className="text-xs text-gray-500">
                        {counts.ideasAndResearched} ideas
                      </span>
                    )}
                    {counts.approved > 0 && (
                      <span className="text-xs text-purple-600 font-medium">
                        {counts.approved} approved
                      </span>
                    )}
                    {counts.ideasAndResearched === 0 && counts.approved === 0 && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">Selected Hubs Stats</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-gray-500 text-xs">Ideas</div>
            <div className="font-semibold text-gray-900">{stats.ideas + stats.researched}</div>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-gray-500 text-xs">Approved</div>
            <div className="font-semibold text-purple-600">{stats.approved}</div>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-gray-500 text-xs">In Progress</div>
            <div className="font-semibold text-yellow-600">{stats.inProgress}</div>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-gray-500 text-xs">Done</div>
            <div className="font-semibold text-green-600">{stats.done}</div>
          </div>
        </div>
        {stats.parked > 0 && (
          <div className="mt-2 text-xs text-orange-600">
            {stats.parked} parked
          </div>
        )}
      </div>
    </div>
  );
}
