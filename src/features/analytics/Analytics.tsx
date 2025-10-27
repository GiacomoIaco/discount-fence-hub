import { useAnalytics } from './hooks/useAnalytics';
import { AnalyticsTabs } from './components/AnalyticsTabs';
import type { UserRole } from '../../types';

interface AnalyticsProps {
  userRole: UserRole;
}

export default function Analytics({ userRole }: AnalyticsProps) {
  const { data, loading, error } = useAnalytics();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load analytics</p>
        </div>
      </div>
    );
  }

  return <AnalyticsTabs data={data} userRole={userRole} />;
}
