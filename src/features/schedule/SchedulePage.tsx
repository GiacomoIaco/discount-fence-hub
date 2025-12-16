import { Calendar } from 'lucide-react';
import { ScheduleCalendar } from './components/ScheduleCalendar';

// ============================================
// SCHEDULE PAGE
// Main entry point for the scheduling feature
// ============================================

interface SchedulePageProps {
  onBack?: () => void;
  onNavigateToRequest?: (requestId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function SchedulePage({
  onNavigateToRequest,
  onNavigateToJob,
}: SchedulePageProps) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-600" />
              Schedule
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage crew schedules, assessments, and appointments
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-gray-600">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-gray-600">Staged</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600">Loaded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600">Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-gray-600">Assessment</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 overflow-hidden">
        <ScheduleCalendar
          onNavigateToJob={onNavigateToJob}
          onNavigateToRequest={onNavigateToRequest}
        />
      </div>
    </div>
  );
}
