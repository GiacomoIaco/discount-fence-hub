import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import RoadmapSidebar from './components/RoadmapSidebar';
import type { HubKey } from './RoadmapHub';

interface RoadmapStats {
  total: number;
  ideas: number;
  inProgress: number;
  done: number;
  approved: number;
}

interface RoadmapLayoutProps {
  children: ReactNode;
  selectedHubs: Set<HubKey>;
  onToggleHub: (hub: HubKey) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  stats: RoadmapStats;
  onBack?: () => void;
}

export default function RoadmapLayout({
  children,
  selectedHubs,
  onToggleHub,
  onSelectAll,
  onClearAll,
  stats,
  onBack
}: RoadmapLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar - Hub Selection */}
      <RoadmapSidebar
        selectedHubs={selectedHubs}
        onToggleHub={onToggleHub}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Main App"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">Roadmap Hub</h1>
          </div>

          {/* Stats Summary */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              <span className="font-medium text-gray-900">{stats.total}</span> items
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              <span className="font-medium text-yellow-600">{stats.inProgress}</span> in progress
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              <span className="font-medium text-green-600">{stats.done}</span> done
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
