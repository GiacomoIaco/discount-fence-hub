import { BarChart, TrendingUp, Camera, Briefcase, FileSpreadsheet } from 'lucide-react';
import { OverviewTab } from './OverviewTab';
import { RequestsTab } from './RequestsTab';
import FsmAnalyticsTab from './FsmAnalyticsTab';
import PhotoAnalytics from '../../photos/components/PhotoAnalytics';
import { JobberDataTab } from './jobber/JobberDataTab';
import { DateRangePicker } from './DateRangePicker';
import type { AnalyticsData, DateRange } from '../hooks/useAnalytics';
import type { UserRole } from '../../../types';

export type TabId = 'overview' | 'requests' | 'sales' | 'photos' | 'jobber';

interface AnalyticsTabsProps {
  data: AnalyticsData | null;
  loading: boolean;
  error: Error | null;
  userRole: UserRole;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function AnalyticsTabs({ data, loading, error, userRole, dateRange, onDateRangeChange, activeTab, onTabChange }: AnalyticsTabsProps) {
  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: TrendingUp },
    { id: 'requests' as TabId, label: 'Requests', icon: BarChart },
    { id: 'sales' as TabId, label: 'Sales & Ops', icon: Briefcase },
    { id: 'photos' as TabId, label: 'Photos', icon: Camera },
    { id: 'jobber' as TabId, label: 'Jobber Data', icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>

        {/* Date Range Picker - Hide for Photos, Sales, and Jobber tabs since they have their own data loading */}
        {activeTab !== 'photos' && activeTab !== 'sales' && activeTab !== 'jobber' && (
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {/* Sales, Photos, and Jobber tabs load their own data, so show them regardless of main loading state */}
        {activeTab === 'sales' ? (
          <FsmAnalyticsTab />
        ) : activeTab === 'photos' ? (
          <PhotoAnalytics onBack={() => onTabChange('overview')} />
        ) : activeTab === 'jobber' ? (
          <JobberDataTab />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics...</p>
            </div>
          </div>
        ) : error || !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-600">Failed to load analytics</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab data={data} userRole={userRole} />
            )}

            {activeTab === 'requests' && (
              <RequestsTab data={data} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
