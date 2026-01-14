import { useState } from 'react';
import { useAnalytics, type DateRange } from './hooks/useAnalytics';
import { AnalyticsTabs, type TabId } from './components/AnalyticsTabs';
import type { UserRole } from '../../types';

interface AnalyticsProps {
  userRole: UserRole;
}

export default function Analytics({ userRole }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data, loading, error } = useAnalytics(dateRange);

  // Keep AnalyticsTabs mounted to preserve tab state
  // Pass loading state down so it can show inline loading
  return (
    <AnalyticsTabs
      data={data}
      loading={loading}
      error={error}
      userRole={userRole}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}
