import { useState } from 'react';
import { useAnalytics, type DateRange } from './hooks/useAnalytics';
import { AnalyticsTabs, type TabId } from './components/AnalyticsTabs';
import { useTabRoute } from '../../hooks/useTabRoute';

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data, loading, error } = useAnalytics(dateRange);

  // Sync tab state with URL
  const { navigateToTab } = useTabRoute<TabId>({
    section: 'analytics',
    activeTab,
    setActiveTab,
  });

  // Keep AnalyticsTabs mounted to preserve tab state
  // Pass loading state down so it can show inline loading
  return (
    <AnalyticsTabs
      data={data}
      loading={loading}
      error={error}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      activeTab={activeTab}
      onTabChange={navigateToTab}
    />
  );
}
