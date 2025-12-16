import { useEffect, useRef } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import { Truck, MapPin, Ruler, Calendar, GripVertical } from 'lucide-react';
import { useUnscheduledJobs, type UnscheduledJob } from '../hooks/useUnscheduledJobs';
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '../../fsm/types';

// ============================================
// UNSCHEDULED JOBS SIDEBAR
// Displays jobs that can be dragged onto the calendar
// ============================================

interface UnscheduledJobsSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function UnscheduledJobsSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: UnscheduledJobsSidebarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: jobs = [], isLoading } = useUnscheduledJobs();

  // Initialize FullCalendar Draggable for external events
  useEffect(() => {
    if (!containerRef.current) return;

    const draggable = new Draggable(containerRef.current, {
      itemSelector: '.draggable-job',
      eventData: (eventEl) => {
        const jobId = eventEl.getAttribute('data-job-id');
        const jobNumber = eventEl.getAttribute('data-job-number');
        const clientName = eventEl.getAttribute('data-client-name');
        const footage = eventEl.getAttribute('data-footage');
        const productType = eventEl.getAttribute('data-product-type');

        return {
          id: `new-${jobId}`,
          title: clientName ? `${jobNumber}: ${clientName}` : jobNumber,
          duration: '04:00', // Default 4 hour duration
          extendedProps: {
            jobId,
            footage: footage ? parseInt(footage, 10) : null,
            productType,
            isNewFromSidebar: true,
          },
        };
      },
    });

    return () => {
      draggable.destroy();
    };
  }, [jobs]);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-l flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Expand sidebar"
        >
          <Truck className="w-5 h-5 text-gray-600" />
        </button>
        <div className="mt-4 text-xs text-gray-500 writing-mode-vertical transform rotate-180">
          {jobs.length} Jobs
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Unscheduled Jobs
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Drag to calendar to schedule
          </p>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-100 rounded"
            title="Collapse sidebar"
          >
            <span className="text-gray-400">×</span>
          </button>
        )}
      </div>

      {/* Jobs List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">All jobs scheduled!</p>
          </div>
        ) : (
          jobs.map((job) => (
            <DraggableJobCard key={job.id} job={job} />
          ))
        )}
      </div>

      {/* Footer with count */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
        {jobs.length} job{jobs.length !== 1 ? 's' : ''} awaiting schedule
      </div>
    </div>
  );
}

// ============================================
// DRAGGABLE JOB CARD
// ============================================

function DraggableJobCard({ job }: { job: UnscheduledJob }) {
  const statusColor = JOB_STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-700';
  const statusLabel = JOB_STATUS_LABELS[job.status] || job.status;

  return (
    <div
      className="draggable-job bg-white border rounded-lg p-3 cursor-grab hover:shadow-md hover:border-blue-300 transition-all group"
      data-job-id={job.id}
      data-job-number={job.job_number}
      data-client-name={job.client_name || ''}
      data-footage={job.linear_feet || ''}
      data-product-type={job.product_type || ''}
    >
      {/* Drag Handle */}
      <div className="flex items-start gap-2">
        <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-900 truncate">
              {job.job_number}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {/* Client Name */}
          {job.client_name && (
            <div className="text-sm text-gray-600 truncate mt-0.5">
              {job.client_name}
            </div>
          )}

          {/* Meta Row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {/* Footage */}
            {job.linear_feet && (
              <div className="flex items-center gap-1">
                <Ruler className="w-3 h-3" />
                <span>{job.linear_feet} LF</span>
              </div>
            )}

            {/* Product Type */}
            {job.product_type && (
              <div className="flex items-center gap-1 truncate">
                <span className="text-gray-400">•</span>
                <span className="truncate">{job.product_type}</span>
              </div>
            )}
          </div>

          {/* Location */}
          {(job.job_address?.city || job.community_name) && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />
              <span className="truncate">
                {job.community_name || job.job_address?.city}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnscheduledJobsSidebar;
