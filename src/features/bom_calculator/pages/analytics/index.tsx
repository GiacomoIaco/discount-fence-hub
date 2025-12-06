import { useState } from 'react';
import {
  BarChart3,
  Home,
  DollarSign,
  Clock,
  FolderOpen,
  Package,
  Building2,
  Warehouse
} from 'lucide-react';

// Import all tab components
import OverviewTab from './OverviewTab';
import MaterialPriceTab from './MaterialPriceTab';
import LaborRateTab from './LaborRateTab';
import ProjectsTab from './ProjectsTab';
import SKUPerformanceTab from './SKUPerformanceTab';
import BusinessUnitTab from './BusinessUnitTab';
import YardOperationsTab from './YardOperationsTab';

type AnalyticsTab =
  | 'overview'
  | 'materials'
  | 'labor'
  | 'projects'
  | 'skus'
  | 'business-units'
  | 'yard';

interface TabConfig {
  id: AnalyticsTab;
  label: string;
  icon: React.ElementType;
  color: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: Home, color: 'text-gray-600' },
  { id: 'materials', label: 'Materials', icon: DollarSign, color: 'text-green-600' },
  { id: 'labor', label: 'Labor', icon: Clock, color: 'text-purple-600' },
  { id: 'projects', label: 'Projects', icon: FolderOpen, color: 'text-blue-600' },
  { id: 'skus', label: 'SKUs', icon: Package, color: 'text-indigo-600' },
  { id: 'business-units', label: 'Business Units', icon: Building2, color: 'text-orange-600' },
  { id: 'yard', label: 'Yard Ops', icon: Warehouse, color: 'text-amber-600' },
];

export default function UnifiedAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'materials':
        return <MaterialPriceTab />;
      case 'labor':
        return <LaborRateTab />;
      case 'projects':
        return <ProjectsTab />;
      case 'skus':
        return <SKUPerformanceTab />;
      case 'business-units':
        return <BusinessUnitTab />;
      case 'yard':
        return <YardOperationsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header with Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
              <p className="text-xs text-gray-500">BOM Hub performance and insights</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 pb-0">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-50 text-gray-900 border-t border-l border-r border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  style={{
                    marginBottom: isActive ? '-1px' : '0',
                  }}
                >
                  <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderTabContent()}
      </div>
    </div>
  );
}
